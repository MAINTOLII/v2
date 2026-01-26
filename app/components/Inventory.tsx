
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type ProductRow = {
  id: string;
  slug: string;
  qty: number;
  cost: number;
};

function money(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return `$${v.toFixed(2)}`;
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: 14, maxWidth: 520, margin: "0 auto" },
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  title: { margin: 0, fontSize: 18, fontWeight: 900 },
  small: { fontSize: 12, color: "#6b7280" },

  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    background: "#fff",
    padding: 12,
    boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
  },

  label: { fontSize: 12, fontWeight: 900, color: "#111", marginBottom: 6 },
  input: {
    height: 44,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    outline: "none",
    width: "100%",
    fontSize: 14,
  },
  select: {
    height: 44,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    outline: "none",
    width: "100%",
    fontSize: 14,
    background: "#fff",
  },

  row: { display: "flex", gap: 10, alignItems: "center" },
  col: { flex: 1 },

  plusBtn: {
    height: 44,
    minWidth: 56,
    borderRadius: 14,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 900,
    fontSize: 18,
    cursor: "pointer",
  },

  ghostBtn: {
    height: 44,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111",
    fontWeight: 900,
    cursor: "pointer",
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 14,
    border: "1px solid #eef2f7",
    background: "#fafafa",
    fontSize: 12,
    fontWeight: 900,
    color: "#111",
  },

  err: { marginTop: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", padding: 10, borderRadius: 14, fontSize: 13 },
  ok: { marginTop: 10, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", padding: 10, borderRadius: 14, fontSize: 13 },

  list: { marginTop: 12, borderTop: "1px solid #f1f5f9", paddingTop: 12 },
  listRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 0", borderBottom: "1px solid #f1f5f9" },
  listLeft: { minWidth: 0 },
  slug: { fontWeight: 900, fontSize: 13, color: "#111" },
  meta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  inlinePlus: {
    height: 36,
    minWidth: 44,
    borderRadius: 12,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
};

export default function Inventory() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // form
  const [q, setQ] = useState("");
  const [productId, setProductId] = useState<string>("");
  const [qtyDelta, setQtyDelta] = useState<string>("");
  const [unitCost, setUnitCost] = useState<string>("");

  const productById = useMemo(() => {
    const m: Record<string, ProductRow> = {};
    for (const p of products) m[p.id] = p;
    return m;
  }, [products]);

  const activeProduct = productId ? productById[productId] : null;

  const filteredProducts = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return products;
    return products.filter((p) => (p.slug ?? "").toLowerCase().includes(qq));
  }, [products, q]);

  async function loadProducts() {
    const res = await supabase.from("products").select("id,slug,qty,cost").order("slug", { ascending: true }).limit(5000);
    if (res.error) throw res.error;
    setProducts((res.data ?? []) as any as ProductRow[]);
  }

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      await loadProducts();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate(): { qty: number; cost: number } | null {
    setErr(null);
    setOk(null);

    if (!productId) {
      setErr("Choose a product");
      return null;
    }

    const qty = Number(qtyDelta);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErr("Enter Qty (number > 0)");
      return null;
    }

    const cost = Number(unitCost);
    if (!unitCost.trim().length || !Number.isFinite(cost) || cost < 0) {
      setErr("Cost is required (number ≥ 0)");
      return null;
    }

    // Guard: when adding stock, reject if cost is more than ±15% from current avg cost.
    const avg = Number(activeProduct?.cost ?? 0);
    if (Number.isFinite(avg) && avg > 0) {
      const min = avg * 0.85;
      const max = avg * 1.15;
      if (cost < min || cost > max) {
        setErr(`Rejected: cost must be within ±15% of avg cost (${avg.toFixed(2)}). Allowed: ${min.toFixed(2)} - ${max.toFixed(2)}`);
        return null;
      }
    }

    return { qty, cost };
  }

  async function addStock(selectedProductId?: string) {
    if (saving) return;
    if (selectedProductId) setProductId(selectedProductId);

    const v = validate();
    if (!v) return;

    const qty = v.qty;
    const cost = v.cost;

    setSaving(true);
    setErr(null);
    setOk(null);

    const payload = {
      p_product_id: selectedProductId ?? productId,
      p_qty_delta: Math.abs(qty),
      p_unit_cost: cost,
      p_note: null,
      p_source: "stock",
    };

    // Use RPC for atomic update (recommended). Falls back if RPC not created.
    const rpc = await supabase.rpc("add_inventory_movement", payload as any);

    if (rpc.error) {
      console.warn("RPC add_inventory_movement failed, falling back:", rpc.error.message);

      const p = productById[selectedProductId ?? productId];
      const nextQty = Number(p?.qty ?? 0) + Math.abs(qty);

      const upd = await supabase.from("products").update({ qty: nextQty, cost }).eq("id", selectedProductId ?? productId);
      if (upd.error) {
        setSaving(false);
        setErr(upd.error.message);
        return;
      }

      const ins = await supabase.from("inventory_movements").insert({
        product_id: selectedProductId ?? productId,
        movement_type: "in",
        qty_delta: Math.abs(qty),
        unit_cost: cost,
        note: null,
        source: "stock",
        new_qty: nextQty,
      });

      if (ins.error) {
        setSaving(false);
        setErr(ins.error.message);
        return;
      }
    }

    setQtyDelta("");
    setUnitCost("");

    try {
      await loadProducts();
      const p = productById[selectedProductId ?? productId];
      setOk(`Added +${qty} to ${p?.slug ?? "product"}`);
    } catch (e: any) {
      setOk("Saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Inventory (Quick Add)</h2>
          <div style={s.small}>Select product → enter Qty + Cost → press +</div>
        </div>
        <button type="button" style={s.ghostBtn} onClick={loadAll} disabled={loading || saving}>
          Refresh
        </button>
      </div>

      <div style={s.card}>
        <div style={{ marginBottom: 10 }}>
          <div style={s.label}>Search</div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type product name/slug…" style={s.input} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={s.label}>Product</div>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} style={s.select}>
            <option value="">— choose —</option>
            {filteredProducts.slice(0, 300).map((p) => (
              <option key={p.id} value={p.id}>
                {(p.slug ?? "Unnamed").slice(0, 70)}
              </option>
            ))}
          </select>
          {filteredProducts.length > 300 ? <div style={{ ...s.small, marginTop: 6 }}>Showing first 300. Narrow search.</div> : null}
        </div>

        {activeProduct ? (
          <div style={{ marginBottom: 12 }}>
            <span style={s.badge}>
              qty: {Number(activeProduct.qty ?? 0)} • cost: {money(Number(activeProduct.cost ?? 0))}
            </span>
          </div>
        ) : null}

        <div style={s.row}>
          <div style={s.col}>
            <div style={s.label}>Qty</div>
            <input value={qtyDelta} onChange={(e) => setQtyDelta(e.target.value)} placeholder="e.g. 10" inputMode="decimal" style={s.input} />
          </div>
          <div style={s.col}>
            <div style={s.label}>Cost</div>
            <input value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="e.g. 1.25" inputMode="decimal" style={s.input} />
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <button type="button" style={s.plusBtn} onClick={() => addStock()} disabled={saving || loading}>
              +
            </button>
          </div>
        </div>

        {err ? <div style={s.err}>{err}</div> : null}
        {ok ? <div style={s.ok}>{ok}</div> : null}
      </div>

      {/* Optional: quick list so you can tap + from the list */}
      <div style={s.list}>
        <div style={{ ...s.small, marginBottom: 8 }}>Quick list (first 40 of your search)</div>
        {(q.trim().length ? filteredProducts : products).slice(0, 40).map((p) => (
          <div key={p.id} style={s.listRow}>
            <div style={s.listLeft}>
              <div style={s.slug}>{(p.slug ?? "Unnamed").slice(0, 70)}</div>
              <div style={s.meta}>
                qty: {Number(p.qty ?? 0)} • cost: {money(Number(p.cost ?? 0))}
              </div>
            </div>
            <button
              type="button"
              style={s.inlinePlus}
              disabled={saving || loading}
              onClick={() => {
                setProductId(p.id);
                // focus user to enter qty/cost
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              title="Select this product"
            >
              +
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}