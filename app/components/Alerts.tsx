

// app/components/Alerts.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type ProductRow = {
  id: string;
  slug: string;
  qty: number;
  is_weight: boolean;
  price?: number | null;
};

const s: Record<string, React.CSSProperties> = {
  page: { padding: 14, maxWidth: 980, margin: "0 auto", background: "#fff", minHeight: "100vh", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", color: "#111" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 18, fontWeight: 900 },
  small: { fontSize: 12, color: "#6b7280" },

  grid2: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 12 },
  card: { border: "1px solid #e5e7eb", borderRadius: 16, padding: 12, background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  cardTitle: { fontSize: 14, fontWeight: 900 },

  list: { listStyle: "none", padding: 0, margin: "10px 0 0 0", display: "grid", gap: 8 },
  li: { border: "1px solid #eef2f7", borderRadius: 14, padding: 10, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" },
  slug: { fontWeight: 900, fontSize: 13, color: "#111" },
  meta: { fontSize: 12, color: "#6b7280", marginTop: 3 },
  pill: { display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 900, color: "#111" },

  btn: { height: 38, padding: "0 12px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", fontWeight: 900, cursor: "pointer" },
  err: { marginTop: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", padding: 10, borderRadius: 14, fontSize: 13, fontWeight: 800 },

  shopBox: { marginTop: 12, border: "1px dashed #e5e7eb", borderRadius: 16, padding: 12, background: "#fafafa" },
  shopRow: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" },
  textarea: { width: "100%", minHeight: 120, resize: "vertical", borderRadius: 12, border: "1px solid #e5e7eb", padding: 10, fontSize: 13, outline: "none", background: "#fff" },

  // mobile
  mobile1: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
    marginTop: 12,
  },
};

function money(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  return `$${x.toFixed(2)}`;
}

function clampNum(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function Alerts() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);

  // ✅ tune these thresholds any time
  const LOW_UNIT_QTY = 5; // units
  const LOW_WEIGHT_QTY = 2; // kg

  // Suggested reorder targets
  const TARGET_UNIT_QTY = 24; // units
  const TARGET_WEIGHT_QTY = 10; // kg

  async function load() {
    setLoading(true);
    setErr(null);

    const res = await supabase
      .from("products")
      .select("id,slug,qty,is_weight,price")
      .order("qty", { ascending: true })
      .limit(5000);

    if (res.error) {
      setErr(res.error.message);
      setProducts([]);
      setLoading(false);
      return;
    }

    setProducts((res.data ?? []) as any as ProductRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lowWeighted = useMemo(() => {
    return products
      .filter((p) => !!p.is_weight)
      .filter((p) => Number(p.qty ?? 0) <= LOW_WEIGHT_QTY)
      .slice(0, 30);
  }, [products]);

  const lowUnit = useMemo(() => {
    return products
      .filter((p) => !p.is_weight)
      .filter((p) => Number(p.qty ?? 0) <= LOW_UNIT_QTY)
      .slice(0, 30);
  }, [products]);

  const shoppingList = useMemo(() => {
    const lines: string[] = [];

    for (const p of lowWeighted) {
      const cur = Number(p.qty ?? 0);
      const need = clampNum(TARGET_WEIGHT_QTY - cur, 0, 9999);
      if (need <= 0) continue;
      lines.push(`• ${p.slug}`);
    }

    for (const p of lowUnit) {
      const cur = Number(p.qty ?? 0);
      const need = clampNum(TARGET_UNIT_QTY - cur, 0, 9999);
      if (need <= 0) continue;
      lines.push(`• ${p.slug}`);
    }

    if (lines.length === 0) return "No low-stock items today.";
    return lines.join("\n");
  }, [lowWeighted, lowUnit]);

  const isMobile = useMemo(() => {
    // purely for layout; safe default
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 720;
  }, []);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Alerts</h2>
          <div style={s.small}>Low stock split into 2 columns (Weighted vs Unit) + auto shopping list</div>
        </div>

        <button type="button" style={s.btn} onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      {err ? <div style={s.err}>{err}</div> : null}

      <div style={isMobile ? s.mobile1 : s.grid2}>
        {/* Weighted */}
        <div style={s.card}>
          <div style={s.cardHead}>
            <div style={s.cardTitle}>Low stock (Weighted)</div>
            <div style={s.small}>is_weight = true • ≤ {LOW_WEIGHT_QTY} kg</div>
          </div>

          {loading ? (
            <div style={{ marginTop: 10, ...s.small }}>Loading…</div>
          ) : lowWeighted.length === 0 ? (
            <div style={{ marginTop: 10, ...s.small }}>Nothing low right now.</div>
          ) : (
            <ul style={s.list}>
              {lowWeighted.map((p) => (
                <li key={p.id} style={s.li}>
                  <div style={{ minWidth: 0 }}>
                    <div style={s.slug}>{p.slug}</div>
                    <div style={s.meta}>Price {money(Number(p.price ?? 0))} / kg</div>
                  </div>
                  <span style={s.pill}>{Number(p.qty ?? 0).toFixed(2)} kg</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Unit */}
        <div style={s.card}>
          <div style={s.cardHead}>
            <div style={s.cardTitle}>Low stock (Unit)</div>
            <div style={s.small}>is_weight = false • ≤ {LOW_UNIT_QTY} pcs</div>
          </div>

          {loading ? (
            <div style={{ marginTop: 10, ...s.small }}>Loading…</div>
          ) : lowUnit.length === 0 ? (
            <div style={{ marginTop: 10, ...s.small }}>Nothing low right now.</div>
          ) : (
            <ul style={s.list}>
              {lowUnit.map((p) => (
                <li key={p.id} style={s.li}>
                  <div style={{ minWidth: 0 }}>
                    <div style={s.slug}>{p.slug}</div>
                    <div style={s.meta}>Price {money(Number(p.price ?? 0))}</div>
                  </div>
                  <span style={s.pill}>{Number(p.qty ?? 0).toFixed(0)} pcs</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={s.shopBox}>
        <div style={s.shopRow}>
          <div>
            <div style={{ fontWeight: 900 }}>Shopping list</div>
            <div style={s.small}>Auto-generated from low stock (copy/paste to WhatsApp)</div>
          </div>
          <button
            type="button"
            style={s.btn}
            onClick={() => {
              try {
                navigator.clipboard.writeText(shoppingList);
              } catch {}
            }}
          >
            Copy
          </button>
        </div>
        <div style={{ height: 8 }} />
        <textarea readOnly value={shoppingList} style={s.textarea} />
      </div>
    </div>
  );
}