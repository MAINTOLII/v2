

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type ProductRow = {
  id: string;
  slug: string | null;
  name_en: string | null;
  name_so: string | null;
  qty: number | null;
  cost: number | null;
};

type MovementRow = {
  id: string;
  created_at: string;
  product_id: string;
  movement_type: "in" | "out" | "adjust";
  qty_delta: number;
  unit_cost: number | null;
  note: string | null;
  source: string | null;
  created_by: string | null;
  new_qty: number | null;
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function money(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return `$${v.toFixed(2)}`;
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: 16 },
  header: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  title: { margin: 0, fontSize: 18, fontWeight: 900 },
  small: { fontSize: 12, color: "#6b7280" },

  card: { border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff", padding: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.04)" },
  row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  grid: { display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 10 },
  kpi: { border: "1px solid #eef2f7", borderRadius: 16, background: "#fafafa", padding: 12 },
  kpiLabel: { fontSize: 12, color: "#6b7280", fontWeight: 800 },
  kpiValue: { fontSize: 18, fontWeight: 900 },

  label: { fontSize: 12, fontWeight: 900, color: "#111" },
  input: { height: 40, padding: "0 12px", borderRadius: 12, border: "1px solid #e5e7eb", outline: "none", width: "100%" },
  select: { height: 40, padding: "0 12px", borderRadius: 12, border: "1px solid #e5e7eb", outline: "none", width: "100%" },

  btn: { height: 40, padding: "0 14px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", fontWeight: 900, cursor: "pointer" },
  btnGhost: { height: 40, padding: "0 14px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", color: "#111", fontWeight: 900, cursor: "pointer" },

  tableWrap: { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
  th: { textAlign: "left", fontSize: 12, color: "#6b7280", padding: "10px 12px", borderBottom: "1px solid #eef2f7", background: "#fafafa", position: "sticky", top: 0 },
  td: { padding: "10px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 13, verticalAlign: "top" },
  right: { textAlign: "right" },
  badge: { display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 999, border: "1px solid #e5e7eb", fontSize: 12, fontWeight: 900, background: "#fff" },

  err: { marginTop: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", padding: 10, borderRadius: 14, fontSize: 13 },
};

export default function Inventory() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // form
  const [q, setQ] = useState("");
  const [productId, setProductId] = useState<string>("");
  const [movementType, setMovementType] = useState<"in" | "out" | "adjust">("in");
  const [qtyDelta, setQtyDelta] = useState<string>("");
  const [unitCost, setUnitCost] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [source, setSource] = useState<string>("stock");

  // filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}-01`;
  });
  const [toDate, setToDate] = useState(() => todayISO());
  const [filterProductId, setFilterProductId] = useState<string>("");

  const productById = useMemo(() => {
    const m: Record<string, ProductRow> = {};
    for (const p of products) m[p.id] = p;
    return m;
  }, [products]);

  const activeProduct = productId ? productById[productId] : null;

  const filteredProducts = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return products;
    return products.filter((p) => {
      const a = (p.name_en ?? "").toLowerCase();
      const b = (p.name_so ?? "").toLowerCase();
      const c = (p.slug ?? "").toLowerCase();
      return a.includes(qq) || b.includes(qq) || c.includes(qq);
    });
  }, [products, q]);

  async function loadProducts() {
    const res = await supabase
      .from("products")
      .select("id,slug,name_en,name_so,qty,cost")
      .order("name_en", { ascending: true })
      .limit(5000);

    if (res.error) throw res.error;
    setProducts((res.data ?? []) as any as ProductRow[]);
  }

  async function loadMovements() {
    const start = fromDate;
    const end = toDate;

    let qy: any = supabase
      .from("inventory_movements")
      .select("id,created_at,product_id,movement_type,qty_delta,unit_cost,note,source,created_by,new_qty")
      .gte("created_at", new Date(start + "T00:00:00Z").toISOString())
      .lte("created_at", new Date(end + "T23:59:59Z").toISOString())
      .order("created_at", { ascending: false })
      .limit(500);

    if (filterProductId) qy = qy.eq("product_id", filterProductId);

    const res = await qy;
    if (res.error) throw res.error;
    setMovements((res.data ?? []) as any as MovementRow[]);
  }

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      await Promise.all([loadProducts(), loadMovements()]);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setProducts([]);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // refresh movement list when filters change
    (async () => {
      try {
        await loadMovements();
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, filterProductId]);

  const kpis = useMemo(() => {
    const totalItems = products.length;
    const low = products.filter((p) => Number(p.qty ?? 0) <= 5).length;
    const zero = products.filter((p) => Number(p.qty ?? 0) <= 0).length;
    return { totalItems, low, zero };
  }, [products]);

  async function submitMovement(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!productId) {
      setErr("Choose a product");
      return;
    }

    const rawQty = Number(qtyDelta);
    if (!Number.isFinite(rawQty) || rawQty === 0) {
      setErr("Enter qty (non-zero)");
      return;
    }

    const delta = movementType === "in" ? Math.abs(rawQty) : movementType === "out" ? -Math.abs(rawQty) : rawQty;

    const costNum = unitCost.trim().length ? Number(unitCost) : null;
    if (unitCost.trim().length && (!Number.isFinite(costNum as any) || (costNum as any) < 0)) {
      setErr("Cost must be a number >= 0");
      return;
    }

    // Frontend rule: when adding stock (IN) with a unit cost,
    // reject if unit cost is more than ±15% from current average cost.
    // (If avg cost is 0 or null, we allow any cost to seed the average.)
    if (movementType === "in" && costNum !== null) {
      const avg = Number(activeProduct?.cost ?? 0);
      if (Number.isFinite(avg) && avg > 0) {
        const min = avg * 0.85;
        const max = avg * 1.15;
        if (costNum < min || costNum > max) {
          setErr(
            `Rejected: cost must be within ±15% of avg cost (${avg.toFixed(2)}). Allowed: ${min.toFixed(2)} - ${max.toFixed(2)}`
          );
          return;
        }
      }
    }

    setSaving(true);

    // Use RPC for atomic update (recommended). Falls back to non-atomic if RPC not created yet.
    const payload = {
      p_product_id: productId,
      p_qty_delta: delta,
      p_unit_cost: costNum,
      p_note: note.trim().length ? note.trim() : null,
      p_source: source.trim().length ? source.trim() : null,
    };

    const rpc = await supabase.rpc("add_inventory_movement", payload as any);

    if (rpc.error) {
      // fallback: do basic updates (not atomic)
      console.warn("RPC add_inventory_movement failed, falling back:", rpc.error.message);

      const p = activeProduct;
      const nextQty = Number(p?.qty ?? 0) + delta;

      const upd = await supabase
        .from("products")
        .update({ qty: nextQty, ...(costNum !== null ? { cost: costNum } : {}) })
        .eq("id", productId);

      if (upd.error) {
        setSaving(false);
        setErr(upd.error.message);
        return;
      }

      const ins = await supabase.from("inventory_movements").insert({
        product_id: productId,
        movement_type: movementType,
        qty_delta: delta,
        unit_cost: costNum,
        note: note.trim().length ? note.trim() : null,
        source: source.trim().length ? source.trim() : null,
        new_qty: nextQty,
      });

      if (ins.error) {
        setSaving(false);
        setErr(ins.error.message);
        return;
      }
    }

    // reset quick fields
    setQtyDelta("");
    setUnitCost("");
    setNote("");

    // reload
    try {
      await Promise.all([loadProducts(), loadMovements()]);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Inventory</h2>
          <div style={s.small}>Add stock movements • updates products.qty and products.cost</div>
        </div>
        <div style={s.row}>
          <button type="button" style={s.btnGhost} onClick={loadAll} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div style={s.grid}>
        <div style={{ ...s.kpi, gridColumn: "span 4" }}>
          <div style={s.kpiLabel}>Products</div>
          <div style={s.kpiValue}>{kpis.totalItems}</div>
        </div>
        <div style={{ ...s.kpi, gridColumn: "span 4" }}>
          <div style={s.kpiLabel}>Low stock (≤ 5)</div>
          <div style={s.kpiValue}>{kpis.low}</div>
        </div>
        <div style={{ ...s.kpi, gridColumn: "span 4" }}>
          <div style={s.kpiLabel}>Out of stock</div>
          <div style={s.kpiValue}>{kpis.zero}</div>
        </div>
      </div>

      <div style={{ height: 10 }} />

      {/* Add movement */}
      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 900 }}>Add movement</div>
          {saving ? <div style={s.small}>Saving…</div> : null}
        </div>

        <form onSubmit={submitMovement}>
          <div style={s.grid}>
            <div style={{ gridColumn: "span 12" }}>
              <div style={s.label}>Search product</div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Type name or slug…"
                style={s.input}
              />
            </div>

            <div style={{ gridColumn: "span 12" }}>
              <div style={s.label}>Select product</div>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} style={s.select}>
                <option value="">— choose —</option>
                {filteredProducts.slice(0, 200).map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.name_en ?? p.name_so ?? p.slug ?? "Unnamed").slice(0, 60)}
                  </option>
                ))}
              </select>
              {filteredProducts.length > 200 ? (
                <div style={{ ...s.small, marginTop: 6 }}>Showing first 200 results. Narrow your search.</div>
              ) : null}
            </div>

            <div style={{ gridColumn: "span 4" }}>
              <div style={s.label}>Type</div>
              <select value={movementType} onChange={(e) => setMovementType(e.target.value as any)} style={s.select}>
                <option value="in">IN (add)</option>
                <option value="out">OUT (remove)</option>
                <option value="adjust">ADJUST (+/-)</option>
              </select>
            </div>

            <div style={{ gridColumn: "span 4" }}>
              <div style={s.label}>Qty</div>
              <input
                value={qtyDelta}
                onChange={(e) => setQtyDelta(e.target.value)}
                placeholder={movementType === "adjust" ? "e.g. -3 or 5" : "e.g. 10"}
                inputMode="decimal"
                style={s.input}
              />
            </div>

            <div style={{ gridColumn: "span 4" }}>
              <div style={s.label}>Cost (optional)</div>
              <input
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="Set new cost"
                inputMode="decimal"
                style={s.input}
              />
            </div>

            <div style={{ gridColumn: "span 6" }}>
              <div style={s.label}>Source (optional)</div>
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="stock / supplier / return" style={s.input} />
            </div>

            <div style={{ gridColumn: "span 6" }}>
              <div style={s.label}>Note (optional)</div>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Invoice / reason" style={s.input} />
            </div>

            <div style={{ gridColumn: "span 12" }}>
              <div style={s.row}>
                <button type="submit" style={s.btn} disabled={saving || loading}>
                  Save movement
                </button>
                <button
                  type="button"
                  style={s.btnGhost}
                  onClick={() => {
                    setQtyDelta("");
                    setUnitCost("");
                    setNote("");
                    setSource("stock");
                  }}
                >
                  Clear
                </button>
                {activeProduct ? (
                  <span style={s.badge}>
                    current qty: {Number(activeProduct.qty ?? 0)} • cost: {money(Number(activeProduct.cost ?? 0))}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </form>

        {err ? <div style={s.err}>{err}</div> : null}
      </div>

      <div style={{ height: 10 }} />

      {/* Movements */}
      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 900 }}>Movements</div>
          <div style={s.row}>
            <div>
              <div style={s.label}>From</div>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={s.input} />
            </div>
            <div>
              <div style={s.label}>To</div>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={s.input} />
            </div>
            <div>
              <div style={s.label}>Product</div>
              <select value={filterProductId} onChange={(e) => setFilterProductId(e.target.value)} style={s.select}>
                <option value="">All</option>
                {products.slice(0, 500).map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.name_en ?? p.name_so ?? p.slug ?? "Unnamed").slice(0, 50)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Time</th>
                <th style={s.th}>Product</th>
                <th style={s.th}>Type</th>
                <th style={{ ...s.th, ...s.right }}>Δ Qty</th>
                <th style={{ ...s.th, ...s.right }}>New Qty</th>
                <th style={{ ...s.th, ...s.right }}>Cost</th>
                <th style={s.th}>Source</th>
                <th style={s.th}>Note</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td style={s.td} colSpan={8}>
                    {loading ? "Loading…" : "No movements"}
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const p = productById[m.product_id];
                  const label = (p?.name_en ?? p?.name_so ?? p?.slug ?? m.product_id).slice(0, 40);
                  return (
                    <tr key={m.id}>
                      <td style={s.td}>{new Date(m.created_at).toLocaleString()}</td>
                      <td style={s.td}>{label}</td>
                      <td style={s.td}>
                        <span style={s.badge}>{m.movement_type}</span>
                      </td>
                      <td style={{ ...s.td, ...s.right, fontWeight: 900 }}>{m.qty_delta}</td>
                      <td style={{ ...s.td, ...s.right, fontWeight: 900 }}>{m.new_qty ?? "—"}</td>
                      <td style={{ ...s.td, ...s.right }}>{m.unit_cost == null ? "—" : money(Number(m.unit_cost))}</td>
                      <td style={s.td}>{m.source ?? "—"}</td>
                      <td style={s.td}>{m.note ?? "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}