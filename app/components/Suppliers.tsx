"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type SupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
};

type ProductRow = {
  id: string;
  slug: string;
  qty: number;
  cost: number;
};

type ProductSupplierRow = {
  supplier_id: string;
  product_id: string;
  supplier_sku: string | null;
  last_price: number | null;
  lead_time_days: number | null;
  min_order_qty: number | null;
};

type LowStockRow = {
  product_id: string;
  slug: string;
  qty: number;
  cost: number;
  suppliers: { supplier_id: string; name: string }[];
};

const s: Record<string, React.CSSProperties> = {
  page: { padding: 16 },
  header: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  title: { margin: 0, fontSize: 18, fontWeight: 900 },
  small: { fontSize: 12, color: "#6b7280" },

  tabs: { display: "flex", gap: 8, flexWrap: "wrap" },
  tab: {
    height: 36,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  tabActive: { border: "1px solid #111", background: "#111", color: "#fff" },

  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    background: "#fff",
    padding: 12,
    boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 10 },
  label: { fontSize: 12, fontWeight: 900, color: "#111" },
  input: {
    height: 40,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    outline: "none",
    width: "100%",
  },
  textarea: {
    minHeight: 84,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    outline: "none",
    width: "100%",
    resize: "vertical",
  },
  select: {
    height: 40,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    outline: "none",
    width: "100%",
  },

  btn: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnGhost: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnDanger: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fff",
    color: "#b91c1c",
    fontWeight: 900,
    cursor: "pointer",
  },

  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    background: "#fff",
  },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
  th: {
    textAlign: "left",
    fontSize: 12,
    color: "#6b7280",
    padding: "10px 12px",
    borderBottom: "1px solid #eef2f7",
    background: "#fafafa",
    position: "sticky",
    top: 0,
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 13,
    verticalAlign: "top",
  },
  right: { textAlign: "right" },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    fontSize: 12,
    fontWeight: 900,
    background: "#fff",
  },

  err: {
    marginTop: 10,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
    padding: 10,
    borderRadius: 14,
    fontSize: 13,
  },
};

type TabKey = "suppliers" | "link" | "low";

export default function Suppliers() {
  const [tab, setTab] = useState<TabKey>("suppliers");

  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [links, setLinks] = useState<ProductSupplierRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Supplier form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [isActive, setIsActive] = useState(true);

  // selection
  const [activeSupplierId, setActiveSupplierId] = useState<string>("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Record<string, boolean>>({});

  // low stock
  const [lowThreshold, setLowThreshold] = useState<number>(5);

  const supplierById = useMemo(() => {
    const m: Record<string, SupplierRow> = {};
    for (const r of suppliers) m[r.id] = r;
    return m;
  }, [suppliers]);

  const productById = useMemo(() => {
    const m: Record<string, ProductRow> = {};
    for (const p of products) m[p.id] = p;
    return m;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => (p.slug ?? "").toLowerCase().includes(q));
  }, [products, productSearch]);

  async function loadSuppliers() {
    const res = await supabase
      .from("suppliers")
      .select("id,name,phone,whatsapp,email,address,note,is_active,created_at")
      .order("name", { ascending: true })
      .limit(2000);
    if (res.error) throw res.error;
    setSuppliers((res.data ?? []) as any);
  }

  async function loadProducts() {
    const res = await supabase
      .from("products")
      .select("id,slug,qty,cost")
      .order("slug", { ascending: true })
      .limit(5000);
    if (res.error) throw res.error;
    setProducts((res.data ?? []) as any);
  }

  async function loadLinks() {
    const res = await supabase
      .from("product_suppliers")
      .select("supplier_id,product_id,supplier_sku,last_price,lead_time_days,min_order_qty")
      .limit(10000);
    if (res.error) throw res.error;
    setLinks((res.data ?? []) as any);
  }

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      await Promise.all([loadSuppliers(), loadProducts(), loadLinks()]);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setSuppliers([]);
      setProducts([]);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetSupplierForm() {
    setName("");
    setPhone("");
    setWhatsapp("");
    setEmail("");
    setAddress("");
    setNote("");
    setIsActive(true);
  }

  async function addSupplier(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const nm = name.trim();
    if (!nm) {
      setErr("Supplier name is required");
      return;
    }

    setSaving(true);
    const res = await supabase.from("suppliers").insert({
      name: nm,
      phone: phone.trim().length ? phone.trim() : null,
      whatsapp: whatsapp.trim().length ? whatsapp.trim() : null,
      email: email.trim().length ? email.trim() : null,
      address: address.trim().length ? address.trim() : null,
      note: note.trim().length ? note.trim() : null,
      is_active: isActive,
    });

    if (res.error) {
      setSaving(false);
      setErr(res.error.message);
      return;
    }

    resetSupplierForm();
    await loadSuppliers();
    setSaving(false);
  }

  async function toggleSupplierActive(id: string, next: boolean) {
    setErr(null);
    const res = await supabase.from("suppliers").update({ is_active: next }).eq("id", id);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    await loadSuppliers();
  }

  async function deleteSupplier(id: string) {
    if (!confirm("Delete this supplier? (Links will also be deleted)")) return;
    setErr(null);
    setSaving(true);

    const dl = await supabase.from("product_suppliers").delete().eq("supplier_id", id);
    if (dl.error) {
      setSaving(false);
      setErr(dl.error.message);
      return;
    }

    const res = await supabase.from("suppliers").delete().eq("id", id);
    if (res.error) {
      setSaving(false);
      setErr(res.error.message);
      return;
    }

    if (activeSupplierId === id) setActiveSupplierId("");
    await loadSuppliers();
    await loadLinks();
    setSaving(false);
  }

  const supplierProducts = useMemo(() => {
    if (!activeSupplierId) return [] as ProductRow[];
    const pids = new Set(links.filter((l) => l.supplier_id === activeSupplierId).map((l) => l.product_id));
    return products.filter((p) => pids.has(p.id));
  }, [activeSupplierId, links, products]);

  useEffect(() => {
    if (!activeSupplierId) {
      setSelectedProducts({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const l of links) {
      if (l.supplier_id === activeSupplierId) next[l.product_id] = true;
    }
    setSelectedProducts(next);
  }, [activeSupplierId, links]);

  async function saveLinks() {
    if (!activeSupplierId) {
      setErr("Choose a supplier first");
      return;
    }
    setErr(null);
    setSaving(true);

    const chosen = Object.entries(selectedProducts)
      .filter(([, v]) => !!v)
      .map(([k]) => k);

    const current = new Set(links.filter((l) => l.supplier_id === activeSupplierId).map((l) => l.product_id));
    const toAdd = chosen.filter((pid) => !current.has(pid));
    const toRemove = Array.from(current).filter((pid) => !chosen.includes(pid));

    if (toAdd.length) {
      const ins = await supabase
        .from("product_suppliers")
        .insert(toAdd.map((pid) => ({ supplier_id: activeSupplierId, product_id: pid })));
      if (ins.error) {
        setSaving(false);
        setErr(ins.error.message);
        return;
      }
    }

    if (toRemove.length) {
      const del = await supabase
        .from("product_suppliers")
        .delete()
        .eq("supplier_id", activeSupplierId)
        .in("product_id", toRemove);

      if (del.error) {
        setSaving(false);
        setErr(del.error.message);
        return;
      }
    }

    await loadLinks();
    setSaving(false);
  }

  const lowStockList = useMemo((): LowStockRow[] => {
    const low = products.filter((p) => Number(p.qty ?? 0) <= lowThreshold);

    const suppliersByProduct: Record<string, { supplier_id: string; name: string }[]> = {};
    for (const l of links) {
      const sRow = supplierById[l.supplier_id];
      if (!sRow) continue;
      if (!suppliersByProduct[l.product_id]) suppliersByProduct[l.product_id] = [];
      suppliersByProduct[l.product_id].push({ supplier_id: l.supplier_id, name: sRow.name });
    }

    return low
      .map((p) => ({
        product_id: p.id,
        slug: p.slug,
        qty: Number(p.qty ?? 0),
        cost: Number(p.cost ?? 0),
        suppliers: suppliersByProduct[p.id] ?? [],
      }))
      .sort((a, b) => a.qty - b.qty);
  }, [products, links, supplierById, lowThreshold]);

  const lowBySupplier = useMemo(() => {
    const m: Record<string, { supplier: SupplierRow; items: LowStockRow[] }> = {};

    for (const row of lowStockList) {
      if (!row.suppliers.length) continue;
      for (const sp of row.suppliers) {
        const sup = supplierById[sp.supplier_id];
        if (!sup) continue;
        if (!m[sp.supplier_id]) m[sp.supplier_id] = { supplier: sup, items: [] };
        m[sp.supplier_id].items.push(row);
      }
    }

    for (const k of Object.keys(m)) {
      m[k].items.sort((a, b) => a.qty - b.qty);
    }

    return Object.values(m).sort((a, b) => a.supplier.name.localeCompare(b.supplier.name));
  }, [lowStockList, supplierById]);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Suppliers</h2>
          <div style={s.small}>Link products to one or more suppliers • See low stock purchase list</div>
        </div>
        <div style={s.tabs}>
          <button
            type="button"
            style={{ ...s.tab, ...(tab === "suppliers" ? s.tabActive : null) }}
            onClick={() => setTab("suppliers")}
          >
            Suppliers
          </button>
          <button
            type="button"
            style={{ ...s.tab, ...(tab === "link" ? s.tabActive : null) }}
            onClick={() => setTab("link")}
          >
            Link products
          </button>
          <button
            type="button"
            style={{ ...s.tab, ...(tab === "low" ? s.tabActive : null) }}
            onClick={() => setTab("low")}
          >
            Low stock
          </button>
          <button type="button" style={s.btnGhost} onClick={loadAll} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {tab === "suppliers" ? (
        <div style={s.grid}>
          <div style={{ ...s.card, gridColumn: "span 5" }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Add supplier</div>
            <form onSubmit={addSupplier}>
              <div style={s.grid}>
                <div style={{ gridColumn: "span 12" }}>
                  <div style={s.label}>Name</div>
                  <input value={name} onChange={(e) => setName(e.target.value)} style={s.input} placeholder="Supplier name" />
                </div>
                <div style={{ gridColumn: "span 6" }}>
                  <div style={s.label}>Phone</div>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} style={s.input} placeholder="Optional" />
                </div>
                <div style={{ gridColumn: "span 6" }}>
                  <div style={s.label}>WhatsApp</div>
                  <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} style={s.input} placeholder="Optional" />
                </div>
                <div style={{ gridColumn: "span 12" }}>
                  <div style={s.label}>Email</div>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} style={s.input} placeholder="Optional" />
                </div>
                <div style={{ gridColumn: "span 12" }}>
                  <div style={s.label}>Address</div>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} style={s.input} placeholder="Optional" />
                </div>
                <div style={{ gridColumn: "span 12" }}>
                  <div style={s.label}>Note</div>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} style={s.textarea} placeholder="Optional" />
                </div>
                <div style={{ gridColumn: "span 12" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 900 }}>
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                    Active
                  </label>
                </div>
                <div style={{ gridColumn: "span 12", display: "flex", gap: 10 }}>
                  <button type="submit" style={s.btn} disabled={saving}>
                    Add
                  </button>
                  <button type="button" style={s.btnGhost} onClick={resetSupplierForm}>
                    Clear
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div style={{ ...s.card, gridColumn: "span 7" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
              <div style={{ fontWeight: 900 }}>All suppliers</div>
              <div style={s.small}>{suppliers.length} supplier(s)</div>
            </div>

            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Name</th>
                    <th style={s.th}>Phone</th>
                    <th style={s.th}>WhatsApp</th>
                    <th style={s.th}>Active</th>
                    <th style={{ ...s.th, ...s.right }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.length === 0 ? (
                    <tr>
                      <td style={s.td} colSpan={5}>
                        {loading ? "Loading…" : "No suppliers"}
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((sp) => (
                      <tr key={sp.id}>
                        <td style={s.td}>
                          <span style={s.badge}>{sp.name}</span>
                        </td>
                        <td style={s.td}>{sp.phone ?? "—"}</td>
                        <td style={s.td}>{sp.whatsapp ?? "—"}</td>
                        <td style={s.td}>
                          <button
                            type="button"
                            style={{ ...s.btnGhost, height: 34 }}
                            onClick={() => toggleSupplierActive(sp.id, !sp.is_active)}
                          >
                            {sp.is_active ? "yes" : "no"}
                          </button>
                        </td>
                        <td style={{ ...s.td, ...s.right }}>
                          <button type="button" style={{ ...s.btnGhost, height: 34 }} onClick={() => setActiveSupplierId(sp.id)}>
                            Manage
                          </button>
                          <span style={{ width: 8, display: "inline-block" }} />
                          <button type="button" style={{ ...s.btnDanger, height: 34 }} onClick={() => deleteSupplier(sp.id)} disabled={saving}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {activeSupplierId ? (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 14, border: "1px solid #eef2f7", background: "#fafafa" }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Selected supplier</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={s.badge}>{supplierById[activeSupplierId]?.name ?? activeSupplierId}</span>
                  <span style={s.small}>Go to “Link products” tab to assign products.</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : tab === "link" ? (
        <div style={s.grid}>
          <div style={{ ...s.card, gridColumn: "span 4" }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Choose supplier</div>
            <div style={s.label}>Supplier</div>
            <select value={activeSupplierId} onChange={(e) => setActiveSupplierId(e.target.value)} style={s.select}>
              <option value="">— choose —</option>
              {suppliers.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>

            <div style={{ height: 10 }} />

            <div style={s.label}>Search product</div>
            <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} style={s.input} placeholder="search by slug…" />

            <div style={{ height: 10 }} />

            <button type="button" style={s.btn} onClick={saveLinks} disabled={saving || !activeSupplierId}>
              Save links
            </button>

            <div style={{ height: 6 }} />

            <button type="button" style={s.btnGhost} onClick={() => setSelectedProducts({})}>
              Clear selection
            </button>

            <div style={{ marginTop: 10 }}>
              <div style={s.small}>
                Linked products: <b>{supplierProducts.length}</b>
              </div>
            </div>
          </div>

          <div style={{ ...s.card, gridColumn: "span 8" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
              <div style={{ fontWeight: 900 }}>Products</div>
              <div style={s.small}>{filteredProducts.length} product(s)</div>
            </div>

            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Link</th>
                    <th style={s.th}>Product</th>
                    <th style={{ ...s.th, ...s.right }}>Qty</th>
                    <th style={{ ...s.th, ...s.right }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td style={s.td} colSpan={4}>
                        No products
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.slice(0, 500).map((p) => (
                      <tr key={p.id}>
                        <td style={s.td}>
                          <input
                            type="checkbox"
                            checked={!!selectedProducts[p.id]}
                            disabled={!activeSupplierId}
                            onChange={(e) => setSelectedProducts((prev) => ({ ...prev, [p.id]: e.target.checked }))}
                          />
                        </td>
                        <td style={s.td}>
                          <span style={s.badge}>{p.slug}</span>
                        </td>
                        <td style={{ ...s.td, ...s.right, fontWeight: 900 }}>{Number(p.qty ?? 0)}</td>
                        <td style={{ ...s.td, ...s.right }}>${Number(p.cost ?? 0).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredProducts.length > 500 ? <div style={{ ...s.small, marginTop: 8 }}>Showing first 500. Narrow your search.</div> : null}
          </div>
        </div>
      ) : (
        <div style={s.grid}>
          <div style={{ ...s.card, gridColumn: "span 4" }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Low stock settings</div>
            <div style={s.label}>Low stock threshold</div>
            <input
              value={String(lowThreshold)}
              onChange={(e) => setLowThreshold(Math.max(0, Number(e.target.value || 0)))}
              style={s.input}
              inputMode="numeric"
              placeholder="e.g. 5"
            />
            <div style={{ ...s.small, marginTop: 8 }}>Products with qty ≤ threshold will appear here.</div>
          </div>

          <div style={{ ...s.card, gridColumn: "span 8" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
              <div style={{ fontWeight: 900 }}>Buying list</div>
              <div style={s.small}>{lowStockList.length} item(s)</div>
            </div>

            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Product</th>
                    <th style={{ ...s.th, ...s.right }}>Qty</th>
                    <th style={s.th}>Suppliers</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockList.length === 0 ? (
                    <tr>
                      <td style={s.td} colSpan={3}>
                        {loading ? "Loading…" : "No low stock products"}
                      </td>
                    </tr>
                  ) : (
                    lowStockList.map((r) => (
                      <tr key={r.product_id}>
                        <td style={s.td}>
                          <span style={s.badge}>{r.slug}</span>
                        </td>
                        <td style={{ ...s.td, ...s.right, fontWeight: 900 }}>{r.qty}</td>
                        <td style={s.td}>
                          {r.suppliers.length ? (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {r.suppliers.map((sp) => (
                                <span key={sp.supplier_id} style={s.badge}>
                                  {sp.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ height: 12 }} />

            <div style={{ fontWeight: 900, marginBottom: 8 }}>Grouped by supplier</div>
            {lowBySupplier.length === 0 ? (
              <div style={s.small}>No supplier groups yet (link suppliers to products first).</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {lowBySupplier.map((g) => (
                  <div
                    key={g.supplier.id}
                    style={{ border: "1px solid #eef2f7", background: "#fafafa", borderRadius: 16, padding: 12 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={s.badge}>{g.supplier.name}</span>
                      <span style={s.small}>{g.items.length} item(s)</span>
                    </div>
                    <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {g.items.map((it) => (
                        <span key={it.product_id} style={s.badge}>
                          {it.slug} (qty {it.qty})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {err ? <div style={s.err}>{err}</div> : null}
    </div>
  );
}