"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

/* ================= TYPES ================= */

type Product = {
  id: string;
  slug: string;
  qty: number;
  cost: number;
  price: number;
  mrp: number;
  tags: string[];
  is_weight: boolean;
  subsubcategory_id: number | null;
  is_online: boolean;
};

type ProductForm = {
  slug: string;
  qty: string;
  cost: string;
  price: string;
  mrp: string;
  tagsText: string;
  is_weight: boolean;
  is_online: boolean;
  subsubcategory_id: number | null;
};

type Subsubcategory = {
  id: number;
  slug: string | null;
  name_en: string | null;
  name_so: string | null;
};

/* ================= STYLES ================= */

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: 16,
    background: "#fafafa",
    minHeight: "100vh",
    color: "#111",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },
  container: { maxWidth: 1050, margin: "0 auto", display: "grid", gap: 16 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  title: { margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" },
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
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 },
  cardTitle: { margin: 0, fontSize: 16, fontWeight: 900 },
  divider: { height: 1, background: "#f1f5f9", border: 0, margin: "10px 0" },
  formGrid: {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(12, 1fr)",
    alignItems: "end",
  },
  field: { display: "grid", gap: 6 },
  label: { fontSize: 12, fontWeight: 900, opacity: 0.9 },
  input: {
    height: 38,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontSize: 14,
    background: "#fff",
  },
  checkboxRow: { display: "flex", gap: 8, alignItems: "center", height: 38 },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  btn: {
    height: 38,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  btnGhost: {
    height: 38,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  btnDanger: {
    height: 38,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #f1c4c4",
    background: "#fff",
    color: "#b42318",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  grid: {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  },
  productCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    background: "#fff",
    display: "grid",
    gap: 8,
  },
  muted: { fontSize: 12, opacity: 0.75 },
  error: { color: "#b42318", fontWeight: 900, fontSize: 13 },

  // autocomplete
  acWrap: { position: "relative" },
  acList: {
    position: "absolute",
    zIndex: 50,
    top: 44,
    left: 0,
    right: 0,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 6,
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
    maxHeight: 280,
    overflowY: "auto",
  },
  acItem: {
    width: "100%",
    textAlign: "left",
    padding: "10px 10px",
    borderRadius: 10,
    border: "1px solid transparent",
    background: "#fff",
    cursor: "pointer",
    display: "grid",
    gap: 2,
  },
};

/* ================= HELPERS ================= */

function n(v: string): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function parseTags(text: string): string[] {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function subLabel(x: Subsubcategory | null | undefined) {
  if (!x) return "";
  const en = (x.name_en ?? "").trim();
  const so = (x.name_so ?? "").trim();
  const slug = (x.slug ?? "").trim();
  const main = en || so || slug || `#${x.id}`;
  const extra = [so && so !== en ? so : "", slug && slug !== en ? slug : ""]
    .filter(Boolean)
    .join(" • ");
  return extra ? `${main} — ${extra}` : main;
}

/* ================= COMPONENT ================= */

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [subsubcategories, setSubsubcategories] = useState<Subsubcategory[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState<ProductForm>({
    slug: "",
    qty: "0",
    cost: "0",
    price: "0",
    mrp: "0",
    tagsText: "",
    is_weight: false,
    is_online: true,
    subsubcategory_id: null,
  });

  // subsubcategory autocomplete state
  const [subQuery, setSubQuery] = useState<string>("");
  const [subOpen, setSubOpen] = useState<boolean>(false);
  const subBoxRef = useRef<HTMLDivElement | null>(null);

  const subById = useMemo(() => {
    const map: Record<number, Subsubcategory> = {};
    for (const s of subsubcategories) map[s.id] = s;
    return map;
  }, [subsubcategories]);

  const selectedSub = useMemo(() => {
    return form.subsubcategory_id == null ? null : subById[form.subsubcategory_id] ?? null;
  }, [form.subsubcategory_id, subById]);

  const subSuggestions = useMemo(() => {
    const q = subQuery.trim().toLowerCase();
    if (q.length < 2) return [] as Subsubcategory[];

    return subsubcategories
      .filter((x) => {
        const en = (x.name_en ?? "").toLowerCase();
        const so = (x.name_so ?? "").toLowerCase();
        const slug = (x.slug ?? "").toLowerCase();
        return en.includes(q) || so.includes(q) || slug.includes(q);
      })
      .slice(0, 10);
  }, [subQuery, subsubcategories]);

  // close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (subBoxRef.current && !subBoxRef.current.contains(t)) {
        setSubOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function load() {
    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase
      .from("products")
      .select("id,slug,qty,cost,price,mrp,tags,is_weight,subsubcategory_id,is_online,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setProducts([]);
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    setProducts((data ?? []) as any);
    setLoading(false);
  }

  async function loadTaxonomy() {
    const { data, error } = await supabase
      .from("subsubcategories")
      .select("id,slug,name_en,name_so")
      .order("name_en", { ascending: true });

    if (!error) setSubsubcategories((data ?? []) as any);
  }

  useEffect(() => {
    load();
    loadTaxonomy();
  }, []);

  async function create() {
    setSaving(true);
    setErrorMsg("");

    if (!form.slug.trim()) {
      setErrorMsg("Product name (slug) is required");
      setSaving(false);
      return;
    }

    const payload: any = {
      slug: form.slug.trim(),
      qty: n(form.qty),
      cost: n(form.cost),
      price: n(form.price),
      mrp: n(form.mrp),
      tags: parseTags(form.tagsText),
      is_weight: form.is_weight,
      is_online: form.is_online,
      subsubcategory_id: form.subsubcategory_id,
    };

    const { error } = await supabase.from("products").insert(payload);
    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }

    // reset
    setForm({
      slug: "",
      qty: "0",
      cost: "0",
      price: "0",
      mrp: "0",
      tagsText: "",
      is_weight: false,
      is_online: true,
      subsubcategory_id: null,
    });
    setSubQuery("");
    setSubOpen(false);

    await load();
    setSaving(false);
  }

  async function update(slug: string, patch: Partial<Product>) {
    setErrorMsg("");
    const { error } = await supabase.from("products").update(patch as any).eq("slug", slug);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    await load();
  }

  async function remove(slug: string) {
    setErrorMsg("");
    const { error } = await supabase.from("products").delete().eq("slug", slug);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    await load();
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <h1 style={s.title}>Products</h1>
          <div style={s.row}>
            <span style={s.badge}>Total: {products.length}</span>
          </div>
        </header>

        {errorMsg ? (
          <section style={{ ...s.card, borderColor: "#f1c4c4" }}>
            <div style={s.error}>{errorMsg}</div>
          </section>
        ) : null}

        {/* ADD PRODUCT */}
        <section style={s.card}>
          <h2 style={s.cardTitle}>Add product</h2>
          <hr style={s.divider} />

          <div style={s.formGrid}>
            <div style={{ ...s.field, gridColumn: "span 4" }}>
              <label style={s.label}>Product name (slug)</label>
              <input
                style={s.input}
                placeholder="e.g. Al fanar 5kg"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
              <div style={s.muted}>Tip: use a simple readable name; tags handle Somali/English search.</div>
            </div>

            <div style={{ ...s.field, gridColumn: "span 2" }}>
              <label style={s.label}>Stock (qty)</label>
              <input
                style={s.input}
                type="number"
                value={form.qty}
                onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
              />
            </div>

            <div style={{ ...s.field, gridColumn: "span 2" }}>
              <label style={s.label}>Cost</label>
              <input
                style={s.input}
                type="number"
                value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
              />
            </div>

            <div style={{ ...s.field, gridColumn: "span 2" }}>
              <label style={s.label}>Price</label>
              <input
                style={s.input}
                type="number"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>

            <div style={{ ...s.field, gridColumn: "span 2" }}>
              <label style={s.label}>MRP</label>
              <input
                style={s.input}
                type="number"
                value={form.mrp}
                onChange={(e) => setForm((f) => ({ ...f, mrp: e.target.value }))}
              />
            </div>

            <div style={{ ...s.field, gridColumn: "span 4" }}>
              <label style={s.label}>Tags (comma separated)</label>
              <input
                style={s.input}
                placeholder="e.g. rice, bariis"
                value={form.tagsText}
                onChange={(e) => setForm((f) => ({ ...f, tagsText: e.target.value }))}
              />
            </div>

            <div style={{ ...s.field, gridColumn: "span 2" }}>
              <label style={s.label}>Type</label>
              <div style={s.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.is_weight}
                  onChange={(e) => setForm((f) => ({ ...f, is_weight: e.target.checked }))}
                />
                <span style={{ fontWeight: 900 }}>{form.is_weight ? "Weight (kg)" : "Unit"}</span>
              </div>
            </div>

            <div style={{ ...s.field, gridColumn: "span 3" }}>
              <label style={s.label}>Availability</label>
              <div style={s.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.is_online}
                  onChange={(e) => setForm((f) => ({ ...f, is_online: e.target.checked }))}
                />
                <span style={{ fontWeight: 900 }}>
                  {form.is_online ? "Online + In-store" : "In-store only"}
                </span>
              </div>
            </div>

            <div style={{ ...s.field, gridColumn: "span 5" }}>
              <label style={s.label}>Subsubcategory (type 2+ letters)</label>
              <div ref={subBoxRef} style={s.acWrap}>
                <input
                  style={s.input}
                  placeholder={
                    selectedSub
                      ? subLabel(selectedSub)
                      : "Start typing... (e.g. rice, bariis, cleaning)"
                  }
                  value={subQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSubQuery(v);
                    if (v.trim().length >= 2) setSubOpen(true);
                  }}
                  onFocus={() => {
                    if (subQuery.trim().length >= 2) setSubOpen(true);
                  }}
                />

                {selectedSub ? (
                  <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={s.badge}>Selected: {subLabel(selectedSub)}</span>
                    <button
                      type="button"
                      style={s.btnGhost}
                      onClick={() => {
                        setForm((f) => ({ ...f, subsubcategory_id: null }));
                        setSubQuery("");
                        setSubOpen(false);
                      }}
                    >
                      Clear
                    </button>
                  </div>
                ) : null}

                {subOpen && subSuggestions.length > 0 ? (
                  <div style={s.acList}>
                    {subSuggestions.map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        style={s.acItem}
                        onClick={() => {
                          setForm((f) => ({ ...f, subsubcategory_id: x.id }));
                          setSubQuery(subLabel(x));
                          setSubOpen(false);
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>{x.name_en ?? x.name_so ?? x.slug ?? `#${x.id}`}</div>
                        <div style={s.muted}>
                          {x.name_so ? `SO: ${x.name_so}` : ""}
                          {x.slug ? ` • slug: ${x.slug}` : ""}
                          {` • id: ${x.id}`}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}

                {subOpen && subQuery.trim().length >= 2 && subSuggestions.length === 0 ? (
                  <div style={{ ...s.acList, padding: 10, opacity: 0.75 }}>No matches.</div>
                ) : null}
              </div>
            </div>

            <div style={{ ...s.field, gridColumn: "span 2" }}>
              <button style={{ ...s.btn, opacity: saving ? 0.7 : 1 }} onClick={create} disabled={saving}>
                {saving ? "Saving…" : "Create"}
              </button>
            </div>
          </div>
        </section>

        {/* LIST */}
        <section style={s.card}>
          <h2 style={s.cardTitle}>Products</h2>
          <hr style={s.divider} />

          {loading ? (
            <div style={{ opacity: 0.75 }}>Loading…</div>
          ) : (
            <div style={s.grid}>
              {products.map((p) => {
                const sub = p.subsubcategory_id == null ? null : subById[p.subsubcategory_id] ?? null;
                return (
                  <div key={p.id} style={s.productCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 15 }}>{p.slug}</div>
                        <div style={s.muted}>
                          {sub ? `Subsubcategory: ${subLabel(sub)}` : "Subsubcategory: (none)"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <span style={s.badge}>{p.is_weight ? "Weight" : "Unit"}</span>
                        {p.is_online ? <span style={s.badge}>Online</span> : <span style={s.badge}>In-store only</span>}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={s.badge}>Stock: {Number(p.qty ?? 0)}</span>
                      <span style={s.badge}>Cost: {Number(p.cost ?? 0)}</span>
                      <span style={s.badge}>Price: {Number(p.price ?? 0)}</span>
                      <span style={s.badge}>MRP: {Number(p.mrp ?? 0)}</span>
                    </div>

                    <div style={s.muted}>Tags: {(p.tags ?? []).join(", ") || "(none)"}</div>

                    <div style={s.row}>
                      <button
                        type="button"
                        style={s.btnGhost}
                        onClick={() => update(p.slug, { is_online: !p.is_online })}
                      >
                        {p.is_online ? "Make In-store only" : "Make Online"}
                      </button>

                      <button type="button" style={s.btnDanger} onClick={() => remove(p.slug)}>
                        Delete
                      </button>
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