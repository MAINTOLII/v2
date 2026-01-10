"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type CreditRow = {
  id: string;
  customer_id: number | null;
  customer_phone: number | null;
  order_id: string | null;
  amount: number | null;
  status: string | null; // "open" | "paid" (recommended)
  created_at?: string | null;
  paid_at?: string | null;
  note?: string | null;
};

type Customer = {
  id: number;
  name: string | null;
  phone: number | null;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_slug: string;
  qty: number;
  unit_price: number;
  line_total: number;
  is_weight: boolean;
};

const s: Record<string, React.CSSProperties> = {
  page: { padding: 16, background: "#fafafa", minHeight: "100vh", fontFamily: "system-ui" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 20, fontWeight: 800 },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  rowBetween: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" },
  input: { height: 38, padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" },
  select: { height: 38, padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" },
  btn: { height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", fontWeight: 800, cursor: "pointer" },
  btnGhost: { height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", color: "#111", fontWeight: 800, cursor: "pointer" },
  badge: { display: "inline-flex", gap: 8, alignItems: "center", padding: "2px 10px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 800 },
  amountRed: { color: "#b42318", fontWeight: 800 },
  amountGreen: { color: "#067647", fontWeight: 800 },
  cardBtn: { width: "100%", textAlign: "left", border: "1px solid #e5e7eb", background: "#fff", borderRadius: 12, padding: 12, cursor: "pointer" },
  entry: { borderTop: "1px solid #f1f5f9", paddingTop: 10, marginTop: 10, display: "grid", gap: 6 },
  itemsTable: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: 12, opacity: 0.75, padding: "6px 4px" },
  td: { fontSize: 13, padding: "6px 4px", borderTop: "1px solid #f1f5f9" },
  small: { fontSize: 12, opacity: 0.75 },
  muted: { fontSize: 12, opacity: 0.7 },
  err: { color: "#b42318", fontWeight: 900 },
  ok: { color: "#067647", fontWeight: 900 },
};

function money(n: number) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function fmt(dt?: string | null) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export default function CreditsManager() {
  const [credits, setCredits] = useState<CreditRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [tab, setTab] = useState<"open" | "paid" | "all">("open");
  const [q, setQ] = useState("");

  const [expandedKey, setExpandedKey] = useState<string>("");
  const [itemsByOrderId, setItemsByOrderId] = useState<Record<string, OrderItem[]>>({});
  const [loadingItems, setLoadingItems] = useState(false);

  async function load() {
    setLoading(true);
    setErr("");
    setOk("");

    const [cRes, custRes] = await Promise.all([
      supabase.from("credits").select("*").order("created_at", { ascending: false }).limit(2000),
      supabase.from("customers").select("id,name,phone").order("id", { ascending: false }).limit(2000),
    ]);

    if (cRes.error) {
      setErr(cRes.error.message);
      setLoading(false);
      return;
    }
    if (!custRes.error) setCustomers((custRes.data ?? []) as any);

    setCredits((cRes.data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const byCustomerId = useMemo(() => {
    const m: Record<string, Customer> = {};
    for (const c of customers) m[String(c.id)] = c;
    return m;
  }, [customers]);

  function customerKey(cr: CreditRow) {
    if (cr.customer_id != null) return `cid:${cr.customer_id}`;
    if (cr.customer_phone != null) return `phone:${cr.customer_phone}`;
    return `unknown:${cr.id}`;
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return credits.filter((cr) => {
      const status = (cr.status ?? "").toLowerCase();
      // If user is searching, show full history regardless of tab
      if (!query) {
        if (tab === "open" && status && status !== "open") return false;
        if (tab === "paid" && status && status !== "paid") return false;
      }

      if (!query) return true;

      const cust = cr.customer_id != null ? byCustomerId[String(cr.customer_id)] : null;
      const phone = String(cr.customer_phone ?? cust?.phone ?? "");
      const name = (cust?.name ?? "").toLowerCase();
      const orderId = (cr.order_id ?? "").toLowerCase();

      return phone.includes(query) || name.includes(query) || orderId.includes(query);
    });
  }, [credits, q, tab, byCustomerId]);

  const totals = useMemo(() => {
    const open = filtered.filter((x) => (x.status ?? "").toLowerCase() === "open");
    const paid = filtered.filter((x) => (x.status ?? "").toLowerCase() === "paid");
    const openSum = open.reduce((s, x) => s + Number(x.amount ?? 0), 0);
    const paidSum = paid.reduce((s, x) => s + Number(x.amount ?? 0), 0);
    return { openSum, paidSum };
  }, [filtered]);

  const grouped = useMemo(() => {
    const g: Record<
      string,
      {
        key: string;
        title: string;
        entries: CreditRow[];
        openSum: number;
        paidSum: number;
        orderIds: string[];
      }
    > = {};

    for (const cr of filtered) {
      const key = customerKey(cr);
      const cust = cr.customer_id != null ? byCustomerId[String(cr.customer_id)] : null;
      const phone = cr.customer_phone ?? cust?.phone ?? null;
      const name = cust?.name ?? "Customer";
      const title = `${name} • ${phone ?? ""}`.trim();

      if (!g[key]) {
        g[key] = { key, title, entries: [], openSum: 0, paidSum: 0, orderIds: [] };
      }

      g[key].entries.push(cr);
      const status = (cr.status ?? "open").toLowerCase();
      const amt = Number(cr.amount ?? 0);
      if (status === "paid") g[key].paidSum += amt;
      else g[key].openSum += amt;
      if (cr.order_id) g[key].orderIds.push(cr.order_id);
    }

    // newest first (by latest created_at)
    const arr = Object.values(g);
    arr.sort((a, b) => {
      const at = a.entries[0]?.created_at ? new Date(a.entries[0].created_at).getTime() : 0;
      const bt = b.entries[0]?.created_at ? new Date(b.entries[0].created_at).getTime() : 0;
      return bt - at;
    });

    // rebuild in sorted order for stable rendering
    const out: typeof g = {};
    for (const item of arr) {
      item.entries.sort((x, y) => {
        const xt = x.created_at ? new Date(x.created_at).getTime() : 0;
        const yt = y.created_at ? new Date(y.created_at).getTime() : 0;
        return yt - xt;
      });
      item.orderIds = Array.from(new Set(item.orderIds));
      out[item.key] = item;
    }

    return out;
  }, [filtered, byCustomerId]);

  async function fetchOrderItems(orderIds: string[]) {
    const missing = orderIds.filter((id) => !itemsByOrderId[id]);
    if (missing.length === 0) return;

    setLoadingItems(true);
    const { data, error } = await supabase
      .from("order_items")
      .select("id,order_id,product_slug,qty,unit_price,line_total,is_weight")
      .in("order_id", missing);

    if (!error) {
      const rows = (data ?? []) as any as OrderItem[];
      const next = { ...itemsByOrderId };
      for (const r of rows) {
        if (!next[r.order_id]) next[r.order_id] = [];
        next[r.order_id].push(r);
      }
      setItemsByOrderId(next);
    }
    setLoadingItems(false);
  }

  async function toggleExpand(key: string, orderIds: string[]) {
    if (expandedKey === key) {
      setExpandedKey("");
      return;
    }
    setExpandedKey(key);
    await fetchOrderItems(orderIds);
  }

  async function markPaid(id: string) {
    setErr("");
    setOk("");

    // Try status/paid_at first
    const paidAt = new Date().toISOString();
    let res = await supabase.from("credits").update({ status: "paid", paid_at: paidAt } as any).eq("id", id);

    if (res.error) {
      // Fallback if your table uses is_paid/paid_at
      const res2 = await supabase.from("credits").update({ is_paid: true, paid_at: paidAt } as any).eq("id", id);
      if (res2.error) {
        setErr(res2.error.message);
        return;
      }
    }

    setOk("Marked as paid.");
    await load();
  }

  async function markOpen(id: string) {
    setErr("");
    setOk("");

    let res = await supabase.from("credits").update({ status: "open", paid_at: null } as any).eq("id", id);

    if (res.error) {
      const res2 = await supabase.from("credits").update({ is_paid: false, paid_at: null } as any).eq("id", id);
      if (res2.error) {
        setErr(res2.error.message);
        return;
      }
    }

    setOk("Moved back to open.");
    await load();
  }

  return (
    <main style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Credits</h1>
          <div style={s.small}>Track who took items on credit, when, and mark as paid.</div>
        </div>

        <div style={s.row}>
          <span style={s.badge}>Open: {money(totals.openSum)}</span>
          <span style={s.badge}>Paid: {money(totals.paidSum)}</span>
          <button style={s.btnGhost} onClick={load} type="button">Refresh</button>
        </div>
      </div>

      <div style={{ height: 12 }} />

      {(err || ok) && (
        <div style={{ ...s.card, borderColor: err ? "#f1c4c4" : "#c7f0d1" }}>
          {err ? <div style={s.err}>{err}</div> : null}
          {ok ? <div style={s.ok}>{ok}</div> : null}
        </div>
      )}

      <div style={{ height: 12 }} />

      <div style={s.card}>
        <div style={s.row}>
          <select style={s.select} value={tab} onChange={(e) => setTab(e.target.value as any)}>
            <option value="open">Open</option>
            <option value="paid">Paid</option>
            <option value="all">All</option>
          </select>

          <input
            style={{ ...s.input, flex: 1, minWidth: 240 }}
            placeholder="Search phone, name, order id…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div style={s.card}>
        {loading ? (
          <div style={{ opacity: 0.75 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No credits found.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {Object.values(grouped).map((g) => (
              <div key={g.key}>
                <button
                  type="button"
                  style={s.cardBtn}
                  onClick={() => toggleExpand(g.key, g.orderIds)}
                >
                  <div style={s.rowBetween}>
                    <div style={{ display: "grid", gap: 2 }}>
                      <div style={{ fontWeight: 800 }}>{g.title}</div>
                      <div style={s.muted}>
                        {g.entries.length} entr{g.entries.length === 1 ? "y" : "ies"} • open {money(g.openSum)} • paid {money(g.paidSum)}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span style={s.amountRed}>Open: {money(g.openSum)}</span>
                      <span style={s.amountGreen}>Paid: {money(g.paidSum)}</span>
                    </div>
                  </div>
                </button>

                {expandedKey === g.key ? (
                  <div style={{ ...s.card, marginTop: 8 }}>
                    {loadingItems ? <div style={{ opacity: 0.75 }}>Loading order items…</div> : null}

                    {g.entries.map((cr) => {
                      const status = (cr.status ?? "open").toLowerCase();
                      const isPaid = status === "paid";
                      const items = cr.order_id ? itemsByOrderId[cr.order_id] ?? [] : [];

                      return (
                        <div key={cr.id} style={s.entry}>
                          <div style={s.rowBetween}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ ...s.badge, borderColor: isPaid ? "#c7f0d1" : "#f1c4c4" }}>
                                {isPaid ? "PAID" : "OPEN"}
                              </span>
                              <span style={s.small}>Created: {fmt(cr.created_at)}</span>
                              {cr.paid_at ? <span style={s.small}>Paid: {fmt(cr.paid_at)}</span> : null}
                              {cr.order_id ? <span style={s.small}>Order: {cr.order_id}</span> : null}
                            </div>

                            <div style={isPaid ? s.amountGreen : s.amountRed}>{money(Number(cr.amount ?? 0))}</div>
                          </div>

                          <div style={s.row}>
                            {!isPaid ? (
                              <button style={s.btn} type="button" onClick={() => markPaid(cr.id)}>
                                Mark Paid
                              </button>
                            ) : (
                              <button style={s.btnGhost} type="button" onClick={() => markOpen(cr.id)}>
                                Move to Open
                              </button>
                            )}
                          </div>

                          {cr.order_id ? (
                            items.length === 0 ? (
                              <div style={s.muted}>No items found for this order.</div>
                            ) : (
                              <table style={s.itemsTable}>
                                <thead>
                                  <tr>
                                    <th style={s.th}>Item</th>
                                    <th style={s.th}>Qty</th>
                                    <th style={s.th}>Price</th>
                                    <th style={s.th}>Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((it) => (
                                    <tr key={it.id}>
                                      <td style={s.td}>{it.product_slug}</td>
                                      <td style={s.td}>{it.qty}{it.is_weight ? " kg" : ""}</td>
                                      <td style={s.td}>{money(Number(it.unit_price ?? 0))}</td>
                                      <td style={s.td}>{money(Number(it.line_total ?? 0))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}