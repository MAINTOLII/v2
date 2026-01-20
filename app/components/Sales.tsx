"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type OrderStatus = "pending" | "confirmed" | "completed" | "cancelled";

type Order = {
  id: string;
  phone: string;
  status: OrderStatus;
  channel: "pos" | "website" | "whatsapp";
  total: number;
  profit?: number | null;
  created_at: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_slug: string;
  qty: number;
  unit_price: number;
  unit_cost?: number | null;
  line_total: number;
  is_weight: boolean;
};

type Customer = {
  id: string | number;
  name: string | null;
  phone: string | null;
};

type StatusMode = "confirmed" | "completed" | "both";

type DaySummary = {
  revenue: number;
  cost: number;
  profit: number;
  count: number;
};

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: 12,
    background: "#fafafa",
    minHeight: "100vh",
    color: "#111",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },
  container: { maxWidth: 900, margin: "0 auto", display: "grid", gap: 12 },
  sticky: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: "rgba(250,250,250,0.92)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    borderBottom: "1px solid #e5e7eb",
    padding: "10px 10px",
  },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 18, fontWeight: 950, letterSpacing: "-0.02em" },
  small: { fontSize: 12, opacity: 0.75 },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    fontSize: 12,
    fontWeight: 900,
    background: "#fff",
    whiteSpace: "nowrap",
  },
  badgeGood: { border: "1px solid #b7ebc8", background: "#ecfdf3", color: "#067647" },
  badgeBad: { border: "1px solid #f1c4c4", background: "#fff1f2", color: "#b42318" },
  input: {
    height: 36,
    padding: "7px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontSize: 14,
    background: "#fff",
  },
  select: {
    height: 36,
    padding: "7px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontSize: 14,
    background: "#fff",
    fontWeight: 900,
  },
  btn: {
    height: 36,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnGhost: {
    height: 36,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnDanger: {
    height: 36,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid #f1c4c4",
    background: "#fff",
    color: "#b42318",
    fontWeight: 900,
    cursor: "pointer",
  },
  list: { display: "grid", gap: 10 },
  saleCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#fff",
    padding: 12,
    display: "grid",
    gap: 8,
    cursor: "pointer",
  },
  line: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" },
  strong: { fontWeight: 950 },
  hr: { height: 1, background: "#f1f5f9", border: 0, margin: "6px 0" },
  err: { color: "#b42318", fontWeight: 900, fontSize: 13 },
  ok: { color: "#067647", fontWeight: 900, fontSize: 13 },
};

function money(n: number) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDayISO(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toISOString();
}

function endOfDayISO(dateStr: string) {
  const d = new Date(`${dateStr}T23:59:59.999`);
  return d.toISOString();
}

export default function Sales() {
  const [day, setDay] = useState(() => toISODate(new Date()));
  const [statusMode, setStatusMode] = useState<StatusMode>("both");

  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Record<string, OrderItem[]>>({});
  const [customersByPhone, setCustomersByPhone] = useState<Record<string, Customer>>({});

  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Edits (order-level)
  const [editCustomerName, setEditCustomerName] = useState<Record<string, string>>({}); // key = phone

  // Edits (item-level)
  const [editQty, setEditQty] = useState<Record<string, string>>({}); // key = orderItem.id
  const [editUnitPrice, setEditUnitPrice] = useState<Record<string, string>>({}); // key = orderItem.id

  const statuses = useMemo<OrderStatus[]>(() => {
    if (statusMode === "confirmed") return ["confirmed"];
    if (statusMode === "completed") return ["completed"];
    return ["confirmed", "completed"]; // most useful in your POS flow
  }, [statusMode]);

  const orderCostRevenue = useMemo(() => {
    const map: Record<string, { revenue: number; cost: number; profit: number; itemCount: number }> = {};
    for (const o of orders) {
      const its = items[o.id] ?? [];
      const revenue = its.reduce((sum, it) => sum + Number(it.line_total || 0), 0);
      const cost = its.reduce(
        (sum, it) => sum + Number(it.unit_cost ?? 0) * Number(it.qty ?? 0),
        0
      );
      const profit = revenue - cost;
      map[o.id] = { revenue, cost, profit, itemCount: its.length };
    }
    return map;
  }, [orders, items]);

  const daySummary: DaySummary = useMemo(() => {
    const revenue = orders.reduce((sum, o) => sum + Number(orderCostRevenue[o.id]?.revenue ?? o.total ?? 0), 0);
    const cost = orders.reduce((sum, o) => sum + Number(orderCostRevenue[o.id]?.cost ?? 0), 0);
    const profit = revenue - cost;
    return { revenue, cost, profit, count: orders.length };
  }, [orders, orderCostRevenue]);

  async function load() {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    // POS sales only
    const fromISO = startOfDayISO(day);
    const toISO = endOfDayISO(day);

    const { data: orderRows, error: orderErr } = await supabase
      .from("orders")
      .select("id,phone,status,channel,total,profit,created_at")
      .eq("channel", "pos")
      .in("status", statuses)
      .gte("created_at", fromISO)
      .lt("created_at", toISO)
      .order("created_at", { ascending: false });

    if (orderErr) {
      setOrders([]);
      setItems({});
      setCustomersByPhone({});
      setErrorMsg(orderErr.message);
      setLoading(false);
      return;
    }

    const list = (orderRows ?? []) as Order[];
    setOrders(list);

    const ids = list.map((o) => o.id);
    if (ids.length === 0) {
      setItems({});
      setCustomersByPhone({});
      setLoading(false);
      return;
    }

    // Pull items (unit_cost may exist; if not, cost will show as 0 and profit will equal revenue)
    const { data: itemRows, error: itemsErr } = await supabase
      .from("order_items")
      .select("id,order_id,product_slug,qty,unit_price,unit_cost,line_total,is_weight")
      .in("order_id", ids);

    if (itemsErr) {
      setItems({});
      setCustomersByPhone({});
      setErrorMsg(itemsErr.message);
      setLoading(false);
      return;
    }

    const map: Record<string, OrderItem[]> = {};
    for (const it of (itemRows ?? []) as OrderItem[]) {
      (map[it.order_id] ||= []).push(it);
    }
    setItems(map);

    // Load customers for display (name + phone)
    const phones = Array.from(new Set(list.map((o) => String(o.phone ?? "")).filter(Boolean)));
    if (phones.length === 0) {
      setCustomersByPhone({});
      setLoading(false);
      return;
    }

    const { data: customerRows, error: custErr } = await supabase
      .from("customers")
      .select("id,name,phone")
      .in("phone", phones);

    if (custErr) {
      // not fatal
      setCustomersByPhone({});
      setLoading(false);
      return;
    }

    const cMap: Record<string, Customer> = {};
    for (const c of (customerRows ?? []) as Customer[]) {
      if (!c.phone) continue;
      cMap[String(c.phone)] = c;
    }
    setCustomersByPhone(cMap);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, statusMode]);

  function toggleOpen(orderId: string) {
    setOpenOrderId((cur) => (cur === orderId ? null : orderId));
  }

  function ensureEditSeed(orderId: string) {
    const its = items[orderId] ?? [];
    for (const it of its) {
      if (editQty[it.id] == null) {
        setEditQty((p) => ({ ...p, [it.id]: String(it.qty) }));
      }
      if (editUnitPrice[it.id] == null) {
        setEditUnitPrice((p) => ({ ...p, [it.id]: String(it.unit_price) }));
      }
    }

    const phone = String(orders.find((o) => o.id === orderId)?.phone ?? "");
    if (phone && editCustomerName[phone] == null) {
      const currentName = customersByPhone[phone]?.name ?? "";
      setEditCustomerName((p) => ({ ...p, [phone]: currentName }));
    }
  }

  async function saveOrderEdits(orderId: string) {
    setSavingId(orderId);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const its = items[orderId] ?? [];
      if (its.length === 0) {
        setErrorMsg("No items to edit.");
        return;
      }

      // Update customer name (by phone)
      const order = orders.find((o) => o.id === orderId);
      const phone = String(order?.phone ?? "");
      const newName = phone ? (editCustomerName[phone] ?? "").trim() : "";

      if (phone && newName) {
        // If customer row exists, update name. If not, we just skip.
        await supabase.from("customers").update({ name: newName }).eq("phone", phone);
      }

      // Update items
      for (const it of its) {
        const rawQty = (editQty[it.id] ?? "").trim();
        const rawPrice = (editUnitPrice[it.id] ?? "").trim();

        const nextQty = Number(rawQty);
        const nextPrice = Number(rawPrice);

        if (!Number.isFinite(nextQty) || nextQty <= 0) {
          throw new Error(`Invalid qty for ${it.product_slug}`);
        }
        if (!Number.isFinite(nextPrice) || nextPrice < 0) {
          throw new Error(`Invalid price for ${it.product_slug}`);
        }

        const nextLine = Number((nextQty * nextPrice).toFixed(2));

        const { error } = await supabase
          .from("order_items")
          .update({ qty: nextQty, unit_price: Number(nextPrice.toFixed(2)), line_total: nextLine })
          .eq("id", it.id);

        if (error) throw new Error(error.message);
      }

      // Recalc totals/profit after edits
      await supabase.rpc("recalc_order_total", { p_order_id: orderId });
      await supabase.rpc("recalc_order_profit", { p_order_id: orderId });

      setSuccessMsg("Saved.");
      await load();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Save failed");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteSale(orderId: string) {
    setDeletingId(orderId);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      // Safer default: mark as cancelled using RPC (keeps audit trail)
      // If your RPC blocks cancelling completed orders, fallback to hard delete below.
      const { error: rpcErr } = await supabase.rpc("cancel_order", { p_order_id: orderId });

      if (rpcErr) {
        // Fallback: hard delete (order_items first, then order)
        const { error: delItemsErr } = await supabase.from("order_items").delete().eq("order_id", orderId);
        if (delItemsErr) throw new Error(delItemsErr.message);

        const { error: delOrderErr } = await supabase.from("orders").delete().eq("id", orderId);
        if (delOrderErr) throw new Error(delOrderErr.message);
      }

      setSuccessMsg("Deleted.");
      setOpenOrderId(null);
      await load();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <div style={s.sticky}>
          <div style={s.headerTop}>
            <div>
              <h1 style={s.title}>Sales (POS)</h1>
              <div style={s.small}>Tap a sale to expand • Edit prices/qty • Delete if needed</div>
            </div>

            <div style={s.row}>
              <input
                style={s.input}
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
              <select style={s.select} value={statusMode} onChange={(e) => setStatusMode(e.target.value as StatusMode)}>
                <option value="both">confirmed + completed</option>
                <option value="confirmed">confirmed only</option>
                <option value="completed">completed only</option>
              </select>
              <button style={s.btnGhost} type="button" onClick={() => load()} disabled={loading}>
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>

          <div style={{ ...s.row, marginTop: 10 }}>
            <span style={s.badge}>Sales: {daySummary.count}</span>
            <span style={s.badge}>Revenue: {money(daySummary.revenue)}</span>
            <span style={s.badge}>Cost: {money(daySummary.cost)}</span>
            <span
              style={{
                ...s.badge,
                ...(daySummary.profit >= 0 ? s.badgeGood : s.badgeBad),
              }}
            >
              PNL: {money(daySummary.profit)}
            </span>
          </div>

          {errorMsg ? <div style={{ ...s.err, marginTop: 8 }}>{errorMsg}</div> : null}
          {successMsg ? <div style={{ ...s.ok, marginTop: 8 }}>{successMsg}</div> : null}
        </div>

        <section style={s.card}>
          {loading ? (
            <div style={{ opacity: 0.75 }}>Loading…</div>
          ) : orders.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No POS sales for this day.</div>
          ) : (
            <div style={s.list}>
              {orders.map((o) => {
                const isOpen = openOrderId === o.id;
                const phone = String(o.phone ?? "");
                const cust = customersByPhone[phone];
                const custName = (cust?.name ?? "").trim() || "Customer";

                const calc = orderCostRevenue[o.id] ?? { revenue: Number(o.total || 0), cost: 0, profit: Number(o.profit || 0), itemCount: 0 };

                const time = new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                return (
                  <div
                    key={o.id}
                    style={s.saleCard}
                    onClick={() => {
                      toggleOpen(o.id);
                      if (!isOpen) ensureEditSeed(o.id);
                    }}
                    role="button"
                    aria-label={`Sale ${o.id}`}
                  >
                    <div style={s.line}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={s.strong}>
                          {custName} <span style={{ fontWeight: 800, opacity: 0.7 }}>• {phone}</span>
                        </div>
                        <div style={s.small}>
                          {time} • {o.status} • ID: {o.id}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <span style={s.badge}>rev {money(calc.revenue)}</span>
                        <span style={s.badge}>cost {money(calc.cost)}</span>
                        <span style={{ ...s.badge, ...(calc.profit >= 0 ? s.badgeGood : s.badgeBad) }}>
                          pnl {money(calc.profit)}
                        </span>
                      </div>
                    </div>

                    {!isOpen ? null : (
                      <>
                        <hr style={s.hr} />

                        <div style={{ display: "grid", gap: 10 }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontWeight: 950 }}>Customer</div>
                            <div style={s.row}>
                              <input
                                style={{ ...s.input, flex: 1, minWidth: 220 }}
                                value={editCustomerName[phone] ?? ""}
                                onChange={(e) => setEditCustomerName((p) => ({ ...p, [phone]: e.target.value }))}
                                placeholder="Customer name"
                              />
                              <span style={s.badge}>{phone}</span>
                            </div>
                            <div style={s.small}>Name saves to customers table by phone.</div>
                          </div>

                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontWeight: 950 }}>Items</div>
                            {(items[o.id] ?? []).length === 0 ? (
                              <div style={{ opacity: 0.7, fontSize: 12 }}>No items.</div>
                            ) : (
                              <div style={{ display: "grid", gap: 8 }}>
                                {(items[o.id] ?? []).map((it) => {
                                  const id = it.id;
                                  const unitLabel = it.is_weight ? "kg" : "unit";
                                  const vQty = editQty[id] ?? String(it.qty);
                                  const vPrice = editUnitPrice[id] ?? String(it.unit_price);
                                  const line = Number((Number(vQty || 0) * Number(vPrice || 0)).toFixed(2));

                                  return (
                                    <div key={id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, display: "grid", gap: 6 }}>
                                      <div style={s.line}>
                                        <div style={{ fontWeight: 950 }}>
                                          {it.product_slug} <span style={{ fontWeight: 800, opacity: 0.7 }}>({unitLabel})</span>
                                        </div>
                                        <span style={s.badge}>line {money(line)}</span>
                                      </div>

                                      <div style={s.row}>
                                        <input
                                          style={{ ...s.input, width: 120 }}
                                          inputMode={it.is_weight ? "decimal" : "numeric"}
                                          type="number"
                                          step={it.is_weight ? "0.01" : "1"}
                                          min={it.is_weight ? "0.01" : "1"}
                                          value={vQty}
                                          onChange={(e) => setEditQty((p) => ({ ...p, [id]: e.target.value }))}
                                        />
                                        <input
                                          style={{ ...s.input, width: 140 }}
                                          inputMode="decimal"
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={vPrice}
                                          onChange={(e) => setEditUnitPrice((p) => ({ ...p, [id]: e.target.value }))}
                                        />
                                        <span style={s.badge}>cost/unit {money(Number(it.unit_cost ?? 0))}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div style={s.row}>
                            <button
                              type="button"
                              style={{
                                ...s.btn,
                                opacity: savingId === o.id ? 0.6 : 1,
                                cursor: savingId === o.id ? "not-allowed" : "pointer",
                              }}
                              disabled={savingId === o.id}
                              onClick={() => saveOrderEdits(o.id)}
                            >
                              {savingId === o.id ? "Saving…" : "Save edits"}
                            </button>

                            <button
                              type="button"
                              style={{
                                ...s.btnDanger,
                                opacity: deletingId === o.id ? 0.6 : 1,
                                cursor: deletingId === o.id ? "not-allowed" : "pointer",
                              }}
                              disabled={deletingId === o.id}
                              onClick={() => deleteSale(o.id)}
                            >
                              {deletingId === o.id ? "Deleting…" : "Delete sale"}
                            </button>

                            <span style={s.small}>
                              Delete tries <b>cancel_order</b> first. If it fails, it hard-deletes.
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* keep profit in memory to avoid unused lint warnings if you later want it */}
        <div style={{ display: "none" }}>{money(Number(daySummary.profit ?? 0))}</div>
      </div>
    </main>
  );
}
