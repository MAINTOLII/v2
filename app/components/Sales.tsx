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
  phone: string | number | null;
};

const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: "Arial, sans-serif", margin: 0, padding: 0, background: "#f9f9f9", color: "#111", minHeight: "100vh" },
  header: { background: "#e60000", color: "white", textAlign: "center", padding: 15, fontSize: "1.5rem", fontWeight: 800, position: "sticky", top: 0, zIndex: 30 },
  controls: { display: "flex", gap: 10, justifyContent: "center", alignItems: "center", margin: 15, flexWrap: "wrap" },
  input: { padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", outline: "none" },
  backBtn: { background: "#333", color: "white", border: "none", padding: "8px 15px", borderRadius: 6, cursor: "pointer", fontWeight: 800 },
  tableWrap: { width: "100%" },
  table: { width: "95%", margin: "0 auto 24px auto", borderCollapse: "collapse", background: "white", borderRadius: 10, overflow: "hidden" },
  th: { padding: 10, borderBottom: "1px solid #ddd", textAlign: "left", verticalAlign: "top", background: "#eee", fontWeight: 900, fontSize: 13 },
  td: { padding: 10, borderBottom: "1px solid #ddd", textAlign: "left", verticalAlign: "top", fontSize: 13 },
  itemsList: { fontSize: "0.9rem", color: "#444", marginTop: 5, lineHeight: 1.35 },
  msg: { width: "95%", margin: "0 auto 10px auto", fontWeight: 800, fontSize: 13 },
  err: { color: "#b42318" },
  ok: { color: "#067647" },
  small: { fontSize: 12, color: "#666" },
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
  const [search, setSearch] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Record<string, OrderItem[]>>({});
  const [customersByPhone, setCustomersByPhone] = useState<Record<string, Customer>>({});

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  const orderCostRevenue = useMemo(() => {
    const map: Record<string, { revenue: number; cost: number; profit: number }> = {};
    for (const o of orders) {
      const its = items[o.id] ?? [];
      const revenue = its.reduce((sum, it) => sum + Number(it.line_total || 0), 0);
      const cost = its.reduce((sum, it) => sum + Number(it.unit_cost ?? 0) * Number(it.qty ?? 0), 0);
      const profit = revenue - cost;
      map[o.id] = { revenue, cost, profit };
    }
    return map;
  }, [orders, items]);

  function buyerNameFor(order: Order) {
    const phone = String(order.phone ?? "");
    const c = customersByPhone[phone];
    return (c?.name ?? "").trim() || phone || "—";
  }

  function notesFor(order: Order) {
    // Computed notes so we don't depend on a DB column that may not exist.
    return `channel:${order.channel} • status:${order.status} • id:${order.id}`;
  }

  async function load() {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    const fromISO = startOfDayISO(day);
    const toISO = endOfDayISO(day);

    // POS completed sales only (matches "Sales History")
    const { data: orderRows, error: orderErr } = await supabase
      .from("orders")
      .select("id,phone,status,channel,total,profit,created_at")
      .eq("channel", "pos")
      .eq("status", "completed")
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
      setCustomersByPhone({});
      setLoading(false);
      return;
    }

    const cMap: Record<string, Customer> = {};
    for (const c of (customerRows ?? []) as Customer[]) {
      if (c.phone == null) continue;
      cMap[String(c.phone)] = c;
    }
    setCustomersByPhone(cMap);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;

    return orders.filter((o) => {
      const buyer = buyerNameFor(o).toLowerCase();
      const notes = notesFor(o).toLowerCase();
      return buyer.includes(term) || notes.includes(term);
    });
  }, [orders, search, customersByPhone]);

  return (
    <main style={styles.page}>
      <header style={styles.header}>Sales History</header>

      <div style={styles.controls}>
        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          style={styles.input}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search buyer or notes"
          style={{ ...styles.input, minWidth: 220 }}
        />
        <button
          type="button"
          style={styles.backBtn}
          onClick={() => (window.location.href = "/")}
        >
          Back
        </button>
      </div>

      {errorMsg ? <div style={{ ...styles.msg, ...styles.err }}>{errorMsg}</div> : null}
      {successMsg ? <div style={{ ...styles.msg, ...styles.ok }}>{successMsg}</div> : null}
      {loading ? (
        <div style={{ ...styles.msg, ...styles.small }}>Loading…</div>
      ) : null}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Buyer</th>
              <th style={styles.th}>Revenue</th>
              <th style={styles.th}>Cost</th>
              <th style={styles.th}>Profit</th>
              <th style={styles.th}>Items</th>
              <th style={styles.th}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td style={styles.td} colSpan={7}>
                  <span style={styles.small}>No sales found for this day.</span>
                </td>
              </tr>
            ) : (
              filtered.map((o) => {
                const calc = orderCostRevenue[o.id] ?? { revenue: Number(o.total || 0), cost: 0, profit: Number(o.profit || 0) };
                const buyer = buyerNameFor(o);

                const its = items[o.id] ?? [];
                const itemsText = its.length
                  ? its
                      .map((it) => {
                        const unit = it.is_weight ? "kg" : "unit";
                        const qty = Number(it.qty || 0);
                        return `• ${it.product_slug} (${qty}${it.is_weight ? "kg" : ""})`;
                      })
                      .join("\n")
                  : "—";

                return (
                  <tr key={o.id}>
                    <td style={styles.td}>{new Date(o.created_at).toLocaleString()}</td>
                    <td style={styles.td}>{buyer}</td>
                    <td style={styles.td}>{money(calc.revenue)}</td>
                    <td style={styles.td}>{money(calc.cost)}</td>
                    <td style={styles.td}>{money(calc.profit)}</td>
                    <td style={styles.td}>
                      <div style={styles.itemsList}>
                        {itemsText.split("\n").map((line, idx) => (
                          <div key={idx}>{line}</div>
                        ))}
                      </div>
                    </td>
                    <td style={styles.td}>{notesFor(o)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <style jsx global>{`
        tr:hover {
          background: #fafafa;
        }
      `}</style>
    </main>
  );
}