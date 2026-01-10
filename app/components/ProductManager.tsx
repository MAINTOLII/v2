"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Product = {
  id: string;
  slug: string;
  qty: number;
  cost: number;
  price: number;
  mrp: number;
  tags: string[];
  is_weight: boolean;
  subsubcategory_id: number | null; // bigint FK -> subsubcategories.id
};

type ProductForm = {
  slug: string;
  qty: string;
  cost: string;
  price: string;
  mrp: string;
  tagsText: string;
  is_weight: boolean;
  subsubcategory_id: string; // select value (string)
};

type Subsubcategory = {
  id: number;
  subcategory_id: number | null;
  slug: string | null;
  name_en: string | null;
  name_so: string | null;
  img?: string | null;
};

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: 16,
    background: "#fafafa",
    minHeight: "100vh",
    color: "#111",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },
  container: { maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" },
  titleWrap: { display: "grid", gap: 4 },
  title: { margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" },
  subtitle: { margin: 0, fontSize: 13, opacity: 0.75 },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    background: "white",
    fontSize: 13,
  },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 },
  cardTitle: { margin: 0, fontSize: 16, fontWeight: 800 },
  divider: { height: 1, background: "#f1f5f9", border: 0, margin: "10px 0" },
  formGrid: { display: "grid", gap: 10, gridTemplateColumns: "repeat(12, 1fr)", alignItems: "end" },
  field: { display: "grid", gap: 6 },
  label: { fontSize: 12, fontWeight: 800, opacity: 0.85 },
  input: { height: 38, padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", outline: "none", fontSize: 14, background: "#fff" },
  select: { height: 38, padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", outline: "none", fontSize: 14, background: "#fff" },
  checkboxRow: { display: "flex", alignItems: "center", gap: 8, height: 38, padding: "0 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" },
  actionsRow: { display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" },
  btn: { height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", fontWeight: 900, cursor: "pointer" },
  btnGhost: { height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", color: "#111", fontWeight: 900, cursor: "pointer" },
  btnDanger: { height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #f1c4c4", background: "#fff", color: "#b42318", fontWeight: 900, cursor: "pointer" },
  listHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  search: { height: 38, minWidth: 240, padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", fontSize: 14 },
  grid: { display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" },
  productCard: { border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff", display: "grid", gap: 10 },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  slug: { margin: 0, fontSize: 15, fontWeight: 900, wordBreak: "break-word" as const },
  meta: { fontSize: 12, opacity: 0.8, lineHeight: 1.35 },
  badge: { display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 999, border: "1px solid #e5e7eb", fontSize: 12, fontWeight: 900, background: "#fff" },
  tags: { display: "flex", gap: 6, flexWrap: "wrap" },
  tag: { display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 999, background: "#f3f4f6", border: "1px solid #e5e7eb", fontSize: 12, fontWeight: 800 },
  err: { marginTop: 10, color: "#b42318", fontWeight: 800, fontSize: 13 },
  hint: { marginTop: 10, fontSize: 12, opacity: 0.75 },
};

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

function labelOrId(obj: { id: number; name_en?: string | null; slug?: string | null; name_so?: string | null }) {
  return obj.name_en || obj.slug || obj.name_so || `#${obj.id}`;
}

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [subsubcategories, setSubsubcategories] = useState<Subsubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // fast search for selecting subsubcategory
  const [subsubSearch, setSubsubSearch] = useState<string>("");

  const [form, setForm] = useState<ProductForm>({
    slug: "",
    qty: "0",
    cost: "0",
    price: "0",
    mrp: "0",
    tagsText: "",
    is_weight: false,
    subsubcategory_id: "",
  });

  async function load() {
    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
      setProducts([]);
      setLoading(false);
      return;
    }

    setProducts((data ?? []) as Product[]);
    setLoading(false);
  }

  async function loadTaxonomy() {
    const ssRes = await supabase
      .from("subsubcategories")
      .select("id,subcategory_id,slug,name_en,name_so,img")
      .order("name_en", { ascending: true });

    if (ssRes.error) {
      setErrorMsg(ssRes.error.message);
      return;
    }

    setSubsubcategories((ssRes.data ?? []) as any);
  }

  useEffect(() => {
    load();
    loadTaxonomy();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const inSlug = p.slug.toLowerCase().includes(q);
      const inTags = (p.tags ?? []).some((t) => t.toLowerCase().includes(q));
      const inSub = String(p.subsubcategory_id ?? "").includes(q);
      return inSlug || inTags || inSub;
    });
  }, [products, search]);

  const subsubFiltered = useMemo(() => {
    const q = subsubSearch.trim().toLowerCase();
    if (!q) return subsubcategories.slice(0, 50);
    return subsubcategories
      .filter(
        (x) =>
          String(x.id).includes(q) ||
          (x.slug ?? "").toLowerCase().includes(q) ||
          (x.name_en ?? "").toLowerCase().includes(q) ||
          (x.name_so ?? "").toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [subsubcategories, subsubSearch]);

  function resetForm() {
    setForm({
      slug: "",
      qty: "0",
      cost: "0",
      price: "0",
      mrp: "0",
      tagsText: "",
      is_weight: false,
      subsubcategory_id: "",
    });
    setSubsubSearch("");
  }

  async function create() {
    setSaving(true);
    setErrorMsg("");

    const slug = form.slug.trim();
    if (!slug) {
      setErrorMsg("Slug is required");
      setSaving(false);
      return;
    }

    const payload: any = {
      slug,
      qty: n(form.qty),
      cost: n(form.cost),
      price: n(form.price),
      mrp: n(form.mrp),
      tags: parseTags(form.tagsText),
      is_weight: form.is_weight,
      subsubcategory_id: form.subsubcategory_id ? Number(form.subsubcategory_id) : null,
    };

    const { error } = await supabase.from("products").insert(payload);
    if (error) {
      setErrorMsg(error.message);
      setSaving(false);
      return;
    }

    resetForm();
    await load();
    setSaving(false);
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

  async function update(slug: string, patch: Partial<Product>) {
    setErrorMsg("");
    const { error } = await supabase.from("products").update(patch).eq("slug", slug);
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
          <div style={s.titleWrap}>
            <h1 style={s.title}>Products</h1>
            <p style={s.subtitle}>Create • Search • Edit • Delete • Link to Subsubcategories (fast)</p>
          </div>

          <div style={s.pill}>
            <span style={{ fontWeight: 900 }}>Total</span>
            <span>{products.length}</span>
          </div>
        </header>

        <section style={s.card}>
          <h2 style={s.cardTitle}>Add product</h2>
          <hr style={s.divider} />

          <div style={s.formGrid}>
            <div style={{ ...s.field, gridColumn: "span 4" }}>
              <label style={s.label}>Slug</label>
              <input
                style={s.input}
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="e.g. banana"
              />
            </div>

            <div style={{ ...s.field, gridColumn: "span 2" }}>
              <label style={s.label}>Qty</label>
              <input style={s.input} type="number" step="0.01" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} />
            </div>

            <div style={{ ...s.field, gridColumn: "span 2" }}>
              <label style={s.label}>Cost</label>
              <input style={s.input} type="number" step="0.01" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} />
            </div>

            <div style={{ ...s.field, gridColumn: "span 2" }}>
              <label style={s.label}>Price</label>
              <input style={s.input} type="number" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            </div>

            <div style={{ ...s.field, gridColumn: "span 2" }}>
              <label style={s.label}>MRP</label>
              <input style={s.input} type="number" step="0.01" value={form.mrp} onChange={(e) => setForm((f) => ({ ...f, mrp: e.target.value }))} />
            </div>

            <div style={{ ...s.field, gridColumn: "span 6" }}>
              <label style={s.label}>Tags</label>
              <input
                style={s.input}
                value={form.tagsText}
                onChange={(e) => setForm((f) => ({ ...f, tagsText: e.target.value }))}
                placeholder="comma separated, e.g. fruit, fresh"
              />
            </div>

            <div style={{ ...s.field, gridColumn: "span 6" }}>
              <label style={s.label}>Subsubcategory (search + select)</label>
              <input
                style={s.input}
                value={subsubSearch}
                onChange={(e) => setSubsubSearch(e.target.value)}
                placeholder="Search by id, slug, name…"
              />
              <select
                style={s.select}
                value={form.subsubcategory_id}
                onChange={(e) => setForm((f) => ({ ...f, subsubcategory_id: e.target.value }))}
              >
                <option value="">None</option>
                {subsubFiltered.map((ssc) => (
                  <option key={ssc.id} value={String(ssc.id)}>
                    {ssc.id} — {labelOrId(ssc)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ ...s.field, gridColumn: "span 3" }}>
              <label style={s.label}>Type</label>
              <div style={s.checkboxRow}>
                <input type="checkbox" checked={form.is_weight} onChange={(e) => setForm((f) => ({ ...f, is_weight: e.target.checked }))} />
                <span style={{ fontWeight: 900 }}>{form.is_weight ? "Weight (kg)" : "Unit"}</span>
              </div>
            </div>

            <div style={{ ...s.field, gridColumn: "span 3" }}>
              <label style={s.label}>Actions</label>
              <div style={s.actionsRow}>
                <button style={s.btn} onClick={create} disabled={saving}>
                  {saving ? "Saving…" : "Create"}
                </button>
                <button style={s.btnGhost} type="button" onClick={resetForm}>
                  Clear
                </button>
              </div>
            </div>
          </div>

          {errorMsg ? <div style={s.err}>{errorMsg}</div> : null}
          <div style={s.hint}>
            Tip: search subsubcategory by <b>id</b>, <b>slug</b>, <b>name_en</b>, or <b>name_so</b>.
          </div>
        </section>

        <section style={s.card}>
          <div style={s.listHeader}>
            <h2 style={s.cardTitle}>Products</h2>
            <input style={s.search} placeholder="Search slug or tag…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <hr style={s.divider} />

          {loading ? (
            <div style={{ opacity: 0.75 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No products found.</div>
          ) : (
            <div style={s.grid}>
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} onDelete={remove} onUpdate={update} subsubcategories={subsubcategories} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ProductCard({
  product,
  onDelete,
  onUpdate,
  subsubcategories,
}: {
  product: Product;
  onDelete: (slug: string) => Promise<void>;
  onUpdate: (slug: string, patch: Partial<Product>) => Promise<void>;
  subsubcategories: Subsubcategory[];
}) {
  const [editing, setEditing] = useState(false);

  const [subsubSearchLocal, setSubsubSearchLocal] = useState<string>("");

  const [draft, setDraft] = useState({
    qty: String(product.qty ?? 0),
    cost: String(product.cost ?? 0),
    price: String(product.price ?? 0),
    mrp: String(product.mrp ?? 0),
    tagsText: (product.tags ?? []).join(", "),
    is_weight: !!product.is_weight,
    subsubcategory_id: String(product.subsubcategory_id ?? ""),
  });

  useEffect(() => {
    setDraft({
      qty: String(product.qty ?? 0),
      cost: String(product.cost ?? 0),
      price: String(product.price ?? 0),
      mrp: String(product.mrp ?? 0),
      tagsText: (product.tags ?? []).join(", "),
      is_weight: !!product.is_weight,
      subsubcategory_id: String(product.subsubcategory_id ?? ""),
    });
  }, [product.id, product.qty, product.cost, product.price, product.mrp, product.is_weight, product.subsubcategory_id, product.tags]);

  const ss = subsubcategories.find((x) => x.id === Number(product.subsubcategory_id ?? -1));
  const label = ss ? labelOrId(ss) : "";

  const subsubFilteredLocal = useMemo(() => {
    const q = subsubSearchLocal.trim().toLowerCase();
    if (!q) return subsubcategories.slice(0, 50);
    return subsubcategories
      .filter(
        (x) =>
          String(x.id).includes(q) ||
          (x.slug ?? "").toLowerCase().includes(q) ||
          (x.name_en ?? "").toLowerCase().includes(q) ||
          (x.name_so ?? "").toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [subsubcategories, subsubSearchLocal]);

  async function save() {
    await onUpdate(product.slug, {
      qty: n(draft.qty),
      cost: n(draft.cost),
      price: n(draft.price),
      mrp: n(draft.mrp),
      tags: parseTags(draft.tagsText),
      is_weight: draft.is_weight,
      subsubcategory_id: draft.subsubcategory_id ? Number(draft.subsubcategory_id) : null,
    });
    setEditing(false);
    setSubsubSearchLocal("");
  }

  return (
    <div style={s.productCard}>
      <div style={s.topRow}>
        <div style={{ display: "grid", gap: 6 }}>
          <p style={s.slug}>{product.slug}</p>
          <div style={s.meta}>
            <span style={s.badge}>{product.is_weight ? "Weight (kg)" : "Unit"}</span>
            <div style={{ marginTop: 6 }}>
              Qty: <b>{product.qty}</b> • Price: <b>{product.price}</b> • MRP: <b>{product.mrp}</b> • Cost: <b>{product.cost}</b>
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={s.badge}>Subsub: {product.subsubcategory_id ?? "—"}</span>
              {label ? <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.8 }}>({label})</span> : null}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button style={s.btnGhost} onClick={() => setEditing((v) => !v)}>
            {editing ? "Close" : "Edit"}
          </button>
          <button style={s.btnDanger} onClick={() => onDelete(product.slug)}>
            Delete
          </button>
        </div>
      </div>

      {!!(product.tags?.length) && !editing ? (
        <div style={s.tags}>
          {product.tags.map((t) => (
            <span key={t} style={s.tag}>
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {editing ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={s.formGrid}>
            <div style={{ ...s.field, gridColumn: "span 3" }}>
              <label style={s.label}>Qty</label>
              <input style={s.input} type="number" step="0.01" value={draft.qty} onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))} />
            </div>

            <div style={{ ...s.field, gridColumn: "span 3" }}>
              <label style={s.label}>Cost</label>
              <input style={s.input} type="number" step="0.01" value={draft.cost} onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value }))} />
            </div>

            <div style={{ ...s.field, gridColumn: "span 3" }}>
              <label style={s.label}>Price</label>
              <input style={s.input} type="number" step="0.01" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} />
            </div>

            <div style={{ ...s.field, gridColumn: "span 3" }}>
              <label style={s.label}>MRP</label>
              <input style={s.input} type="number" step="0.01" value={draft.mrp} onChange={(e) => setDraft((d) => ({ ...d, mrp: e.target.value }))} />
            </div>

            <div style={{ ...s.field, gridColumn: "span 7" }}>
              <label style={s.label}>Tags</label>
              <input style={s.input} value={draft.tagsText} onChange={(e) => setDraft((d) => ({ ...d, tagsText: e.target.value }))} placeholder="comma separated" />
            </div>

            <div style={{ ...s.field, gridColumn: "span 5" }}>
              <label style={s.label}>Type</label>
              <div style={s.checkboxRow}>
                <input type="checkbox" checked={draft.is_weight} onChange={(e) => setDraft((d) => ({ ...d, is_weight: e.target.checked }))} />
                <span style={{ fontWeight: 900 }}>{draft.is_weight ? "Weight (kg)" : "Unit"}</span>
              </div>
            </div>

            <div style={{ ...s.field, gridColumn: "span 12" }}>
              <label style={s.label}>Subsubcategory (search + select)</label>
              <input
                style={s.input}
                value={subsubSearchLocal}
                onChange={(e) => setSubsubSearchLocal(e.target.value)}
                placeholder="Search by id, slug, name…"
              />
              <select
                style={s.select}
                value={draft.subsubcategory_id}
                onChange={(e) => setDraft((d) => ({ ...d, subsubcategory_id: e.target.value }))}
              >
                <option value="">None</option>
                {subsubFilteredLocal.map((ssc) => (
                  <option key={ssc.id} value={String(ssc.id)}>
                    {ssc.id} — {labelOrId(ssc)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={s.actionsRow}>
            <button style={s.btn} onClick={save}>
              Save
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}