"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Period = "daily" | "monthly";

type OrderRow = {
  id: string;
  total: number;
  profit: number;
  created_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_slug: string;
  qty: number;
  unit_price: number;
  line_total: number;
  unit_cost: number;
  is_weight: boolean;
};

type ProductRow = {
  id: string;
  slug: string;
  qty: number;
  is_weight: boolean;
  price: number;
};

const s: Record<string, React.CSSProperties> = {
  page: { padding: 16, background: "#fafafa", minHeight: "100vh", color: "#111", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" },
  container: { maxWidth: 1100, margin: "0 auto", display: "grid", gap: 12 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" },
  tabs: { display: "flex", gap: 8, flexWrap: "wrap" },
  tab: {
    height: 38,
    padding: "0 12px",
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
  tabActive: { borderColor: "#111", color: "#111" },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 },
  grid: { display: "grid", gap: 10, gridTemplateColumns: "repeat(12, minmax(0, 1fr))" },
  kpi: { border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff" },
  kpiLabel: { fontSize: 12, opacity: 0.7, marginBottom: 6 },
  kpiValue: { fontSize: 20, fontWeight: 800 },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  small: { fontSize: 12, opacity: 0.75 },
  err: { color: "#b42318", fontWeight: 700, fontSize: 13 },
  btnGhost: { height: 36, padding: "0 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontWeight: 700 },
  list: { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 },
  li: { border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" },
  pill: { display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 700 },
};

function money(n: number) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function toIso(d: Date) {
  return d.toISOString();
}

function getRange(period: Period, now = new Date()) {
  const start = new Date(now);
  const end = new Date(now);

  if (period === "daily") {
    start.setHours(0, 0, 0, 0);
    end.setHours(24, 0, 0, 0);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(end.getMonth() + 1, 1);
    end.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

export default function PNL() {
  const [period, setPeriod] = useState<Period>("daily");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [lowStock, setLowStock] = useState<ProductRow[]>([]);

  const range = useMemo(() => getRange(period), [period]);

  async function load() {
    setLoading(true);
    setErr("");

    const { start, end } = range;

    // Completed orders within range
    const oRes = await supabase
      .from("orders")
      .select("id,total,profit,created_at")
      .eq("status", "completed")
      .gte("created_at", toIso(start))
      .lt("created_at", toIso(end))
      .order("created_at", { ascending: false })
      .limit(5000);

    if (oRes.error) {
      setErr(oRes.error.message);
      setOrders([]);
      setItems([]);
      setLoading(false);
      return;
    }

    const oRows = (oRes.data ?? []) as any as OrderRow[];
    setOrders(oRows);

    // Load items for these orders
    const orderIds = oRows.map((o) => o.id);
    if (orderIds.length === 0) {
      setItems([]);
    } else {
      const iRes = await supabase
        .from("order_items")
        .select("id,order_id,product_slug,qty,unit_price,line_total,unit_cost,is_weight")
        .in("order_id", orderIds)
        .limit(20000);

      if (iRes.error) {
        setErr(iRes.error.message);
        setItems([]);
        setLoading(false);
        return;
      }

      setItems((iRes.data ?? []) as any as OrderItemRow[]);
    }

    // Low stock list
    const pRes = await supabase
      .from("products")
      .select("id,slug,qty,is_weight,price")
      .order("qty", { ascending: true })
      .limit(15);

    if (pRes.error) {
      setErr(pRes.error.message);
      setLowStock([]);
      setLoading(false);
      return;
    }

    setLowStock((pRes.data ?? []) as any as ProductRow[]);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const revenue = useMemo(() => orders.reduce((s, o) => s + Number(o.total ?? 0), 0), [orders]);
  const orderProfit = useMemo(() => orders.reduce((s, o) => s + Number(o.profit ?? 0), 0), [orders]);

  // Prefer cost from order_items (more accurate)
  const cost = useMemo(() => {
    if (items.length === 0) return Math.max(0, revenue - orderProfit);
    return items.reduce((s, it) => s + Number(it.unit_cost ?? 0) * Number(it.qty ?? 0), 0);
  }, [items, revenue, orderProfit]);

  const profit = useMemo(() => {
    // Use orders.profit if available; else revenue-cost
    if (orders.length && orders.some((o) => Number(o.profit ?? 0) !== 0)) return orderProfit;
    return revenue - cost;
  }, [orders, orderProfit, revenue, cost]);

  const topItems = useMemo(() => {
    const map: Record<
      string,
      { slug: string; qty: number; revenue: number; cost: number; is_weight: boolean }
    > = {};

    for (const it of items) {
      const slug = it.product_slug;
      if (!map[slug]) {
        map[slug] = {
          slug,
          qty: 0,
          revenue: 0,
          cost: 0,
          is_weight: !!it.is_weight,
        };
      }
      map[slug].qty += Number(it.qty ?? 0);
      map[slug].revenue += Number(it.line_total ?? 0);
      map[slug].cost += Number(it.unit_cost ?? 0) * Number(it.qty ?? 0);
      map[slug].is_weight = map[slug].is_weight || !!it.is_weight;
    }

    return Object.values(map)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [items]);

  const rangeLabel = useMemo(() => {
    const { start, end } = range;
    const a = start.toLocaleDateString();
    const b = new Date(end.getTime() - 1).toLocaleDateString();
    return period === "daily" ? a : `${a} → ${b}`;
  }, [range, period]);

  return (
    <main style={s.page}>
      <div style={s.container}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>P&L</h1>
            <div style={s.small}>Completed orders only • {rangeLabel}</div>
          </div>

          <div style={s.row}>
            <div style={s.tabs}>
              <button
                type="button"
                style={{ ...s.tab, ...(period === "daily" ? s.tabActive : {}) }}
                onClick={() => setPeriod("daily")}
              >
                Daily
              </button>
              <button
                type="button"
                style={{ ...s.tab, ...(period === "monthly" ? s.tabActive : {}) }}
                onClick={() => setPeriod("monthly")}
              >
                Monthly
              </button>
            </div>
            <button type="button" style={s.btnGhost} onClick={load}>
              Refresh
            </button>
          </div>
        </div>

        {err ? (
          <div style={s.card}>
            <div style={s.err}>{err}</div>
          </div>
        ) : null}

        <div style={s.grid}>
          <div style={{ ...s.kpi, gridColumn: "span 3" }}>
            <div style={s.kpiLabel}>Revenue</div>
            <div style={s.kpiValue}>{money(revenue)}</div>
          </div>
          <div style={{ ...s.kpi, gridColumn: "span 3" }}>
            <div style={s.kpiLabel}>Cost</div>
            <div style={s.kpiValue}>{money(cost)}</div>
          </div>
          <div style={{ ...s.kpi, gridColumn: "span 3" }}>
            <div style={s.kpiLabel}>Profit</div>
            <div style={s.kpiValue}>{money(profit)}</div>
          </div>
          <div style={{ ...s.kpi, gridColumn: "span 3" }}>
            <div style={s.kpiLabel}>Orders</div>
            <div style={s.kpiValue}>{orders.length}</div>
          </div>
        </div>

        <div style={s.grid}>
          <div style={{ ...s.card, gridColumn: "span 7" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700 }}>Most sold items</div>
              <div style={s.small}>by qty</div>
            </div>

            {loading ? (
              <div style={{ opacity: 0.75, marginTop: 8 }}>Loading…</div>
            ) : topItems.length === 0 ? (
              <div style={{ opacity: 0.75, marginTop: 8 }}>No sales in this period.</div>
            ) : (
              <ul style={{ ...s.list, marginTop: 10 }}>
                {topItems.map((x) => (
                  <li key={x.slug} style={s.li}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{x.slug}</div>
                      <div style={s.small}>
                        Qty: {x.qty.toFixed(x.is_weight ? 2 : 0)}{x.is_weight ? " kg" : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span style={s.pill}>Rev {money(x.revenue)}</span>
                      <span style={s.pill}>Cost {money(x.cost)}</span>
                      <span style={s.pill}>Profit {money(x.revenue - x.cost)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ ...s.card, gridColumn: "span 5" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700 }}>Low stock</div>
              <div style={s.small}>lowest qty first</div>
            </div>

            {loading ? (
              <div style={{ opacity: 0.75, marginTop: 8 }}>Loading…</div>
            ) : lowStock.length === 0 ? (
              <div style={{ opacity: 0.75, marginTop: 8 }}>No products found.</div>
            ) : (
              <ul style={{ ...s.list, marginTop: 10 }}>
                {lowStock.map((p) => (
                  <li key={p.id} style={s.li}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{p.slug}</div>
                      <div style={s.small}>Price {money(Number(p.price ?? 0))}</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span style={s.pill}>
                        Stock: {Number(p.qty ?? 0).toFixed(p.is_weight ? 2 : 0)}{p.is_weight ? " kg" : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}