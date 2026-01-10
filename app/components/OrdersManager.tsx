"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type OrderStatus = "pending" | "confirmed" | "completed" | "cancelled";
type OrderChannel = "website" | "whatsapp" | "pos";

type Order = {
  id: string;
  phone: string;
  status: OrderStatus;
  channel: OrderChannel;
  total: number;
  profit: number;
  created_at: string;
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
  page: { padding: 16, background: "#fafafa", minHeight: "100vh", color: "#111", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" },
  container: { maxWidth: 1100, margin: "0 auto", display: "grid", gap: 12 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" },
  subtitle: { margin: 0, fontSize: 13, opacity: 0.75 },

  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 },
  row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  select: { height: 38, borderRadius: 10, border: "1px solid #e5e7eb", padding: "6px 10px", fontWeight: 900, background: "#fff" },

  orderCard: { border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff", display: "grid", gap: 10 },
  badge: { display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 999, border: "1px solid #e5e7eb", fontSize: 12, fontWeight: 900, background: "#fff" },
  badgeBtn: { display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 999, border: "1px solid #e5e7eb", fontSize: 12, fontWeight: 900, background: "#fff", cursor: "pointer" },
  badgeBtnActive: { background: "#111", color: "#fff", border: "1px solid #111" },

  btn: { height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", fontWeight: 900, cursor: "pointer" },
  btnGhost: { height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", color: "#111", fontWeight: 900, cursor: "pointer" },
  btnDanger: { height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #f1c4c4", background: "#fff", color: "#b42318", fontWeight: 900, cursor: "pointer" },

  err: { color: "#b42318", fontWeight: 800, fontSize: 13 },
};

function money(n: number) {
  return `$${Number(n || 0).toFixed(2)}`;
}

export default function OrdersManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<null | { message: string; details?: string; hint?: string; code?: string }>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("pending");

  const [counts, setCounts] = useState<Record<OrderStatus, number>>({
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
  });

  async function loadCounts() {
    const statuses: OrderStatus[] = ["pending", "confirmed", "completed", "cancelled"];
    const next: Record<OrderStatus, number> = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };

    await Promise.all(
      statuses.map(async (st) => {
        const { count } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", st);
        next[st] = count ?? 0;
      })
    );

    setCounts(next);
  }

  async function load(nextFilter?: OrderStatus | "all") {
    setLoading(true);
    setErrorMsg(null);
    await loadCounts();

    const activeFilter = nextFilter ?? statusFilter;
    const q = supabase.from("orders").select("*").order("created_at", { ascending: false });
    const { data: orderRows, error: orderErr } =
      activeFilter === "all" ? await q : await q.eq("status", activeFilter);

    if (orderErr) {
      setErrorMsg({ message: orderErr.message, details: (orderErr as any).details, hint: (orderErr as any).hint, code: (orderErr as any).code });
      setOrders([]);
      setItems({});
      setLoading(false);
      return;
    }

    const list = (orderRows ?? []) as Order[];
    setOrders(list);

    const ids = list.map((o) => o.id);
    if (ids.length === 0) {
      setItems({});
      setLoading(false);
      return;
    }

    const { data: itemRows, error: itemsErr } = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", ids);

    if (itemsErr) {
      setErrorMsg({ message: itemsErr.message, details: (itemsErr as any).details, hint: (itemsErr as any).hint, code: (itemsErr as any).code });
      setItems({});
      setLoading(false);
      return;
    }

    const map: Record<string, OrderItem[]> = {};
    for (const it of (itemRows ?? []) as OrderItem[]) {
      (map[it.order_id] ||= []).push(it);
    }
    setItems(map);
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter]);

  async function confirmOrder(orderId: string) {
    setErrorMsg(null);
    const { error } = await supabase.rpc("confirm_order", { p_order_id: orderId });
    if (error) {
      console.error("confirm_order failed", error);
      setErrorMsg({ message: error.message, details: (error as any).details, hint: (error as any).hint, code: (error as any).code });
    }
    if (!error) {
      setStatusFilter("confirmed");
      await load("confirmed");
      return;
    }
    await load();
  }

  async function completeOrder(orderId: string) {
    setErrorMsg(null);
    const { error } = await supabase.rpc("complete_order", { p_order_id: orderId });
    if (error) {
      console.error("complete_order failed", error);
      setErrorMsg({ message: error.message, details: (error as any).details, hint: (error as any).hint, code: (error as any).code });
    }
    if (!error) {
      setStatusFilter("completed");
      await load("completed");
      return;
    }
    await load();
  }

  async function cancelOrder(orderId: string) {
    setErrorMsg(null);
    const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId });
    if (error) {
      console.error("cancel_order failed", error);
      setErrorMsg({ message: error.message, details: (error as any).details, hint: (error as any).hint, code: (error as any).code });
    }
    if (!error) {
      setStatusFilter("cancelled");
      await load("cancelled");
      return;
    }
    await load();
  }

  const totals = useMemo(() => {
    const revenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const profit = orders.reduce((sum, o) => sum + Number((o as any).profit || 0), 0);
    return { revenue, profit };
  }, [orders]);

  return (
    <main style={s.page}>
      <div style={s.container}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>Orders</h1>
            <p style={s.subtitle}>Confirm → reduces inventory • Complete → final • Cancel → no inventory change</p>
          </div>

          <div style={s.row}>
            <button
              type="button"
              style={{ ...s.badgeBtn, ...(statusFilter === "pending" ? s.badgeBtnActive : null) }}
              onClick={() => setStatusFilter("pending")}
            >
              pending: {counts.pending ?? 0}
            </button>
            <button
              type="button"
              style={{ ...s.badgeBtn, ...(statusFilter === "confirmed" ? s.badgeBtnActive : null) }}
              onClick={() => setStatusFilter("confirmed")}
            >
              confirmed: {counts.confirmed ?? 0}
            </button>
            <button
              type="button"
              style={{ ...s.badgeBtn, ...(statusFilter === "completed" ? s.badgeBtnActive : null) }}
              onClick={() => setStatusFilter("completed")}
            >
              completed: {counts.completed ?? 0}
            </button>
            <button
              type="button"
              style={{ ...s.badgeBtn, ...(statusFilter === "cancelled" ? s.badgeBtnActive : null) }}
              onClick={() => setStatusFilter("cancelled")}
            >
              cancelled: {counts.cancelled ?? 0}
            </button>
            <button
              type="button"
              style={{ ...s.badgeBtn, ...(statusFilter === "all" ? s.badgeBtnActive : null) }}
              onClick={() => setStatusFilter("all")}
            >
              all
            </button>
            {statusFilter === "completed" ? (
              <>
                <span style={s.badge}>revenue: {money(totals.revenue)}</span>
                <span style={s.badge}>profit: {money(totals.profit)}</span>
              </>
            ) : null}
          </div>
        </div>

        {errorMsg ? (
          <div style={{ ...s.card, borderColor: "#f1c4c4" }}>
            <div style={s.err}>{errorMsg.message}</div>
            {errorMsg.code ? <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}><b>Code:</b> {errorMsg.code}</div> : null}
            {errorMsg.details ? <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}><b>Details:</b> {errorMsg.details}</div> : null}
            {errorMsg.hint ? <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}><b>Hint:</b> {errorMsg.hint}</div> : null}
          </div>
        ) : null}

        <section style={s.card}>
          {loading ? (
            <div style={{ opacity: 0.75 }}>Loading…</div>
          ) : orders.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No orders.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {orders.map((o) => {
                const its = items[o.id] ?? [];
                return (
                  <div key={o.id} style={s.orderCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 950 }}>
                          {o.phone} <span style={{ fontWeight: 800, opacity: 0.7 }}>• {o.channel}</span>
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          ID: {o.id} • {new Date(o.created_at).toLocaleString()}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span style={s.badge}>status: {o.status}</span>
                          <span style={s.badge}>total: {money(Number(o.total) || 0)}</span>
                          <span style={s.badge}>profit: {money(Number((o as any).profit) || 0)}</span>
                          <span style={s.badge}>items: {its.length}</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
                        {o.status === "pending" ? (
                          <>
                            <button style={s.btn} onClick={() => confirmOrder(o.id)}>Confirm (reduce stock)</button>
                            <button style={s.btnDanger} onClick={() => cancelOrder(o.id)}>Cancel</button>
                          </>
                        ) : null}

                        {o.status === "confirmed" ? (
                          <>
                            <button style={s.btn} onClick={() => completeOrder(o.id)}>Complete</button>
                            <button style={s.btnDanger} onClick={() => cancelOrder(o.id)}>Cancel</button>
                          </>
                        ) : null}

                        {(o.status === "completed" || o.status === "cancelled") ? (
                          <button style={s.btnGhost} disabled>Locked</button>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10, display: "grid", gap: 6 }}>
                      {its.length === 0 ? (
                        <div style={{ opacity: 0.7, fontSize: 12 }}>No items.</div>
                      ) : (
                        its.map((it) => (
                          <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                            <div style={{ fontWeight: 900 }}>
                              {it.product_slug} <span style={{ fontWeight: 800, opacity: 0.7 }}>({it.is_weight ? "kg" : "unit"})</span>
                            </div>
                            <div style={{ opacity: 0.85 }}>
                              qty: <b>{it.qty}</b> • unit: <b>{money(it.unit_price)}</b> • line: <b>{money(it.line_total)}</b>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}