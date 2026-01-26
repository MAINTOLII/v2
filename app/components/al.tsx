"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string; // uuid
  slug?: string | null;
  qty?: number | null;
  cost?: number | null;
  price?: number | null;
  tags?: string[] | null; // text[]
  subsubcategory_id?: number | null;
  img?: string | null;
};

type FieldType = "text" | "number" | "bool" | "textarea";

type FieldDef = {
  key: keyof Product;
  label: string;
  type: FieldType;
  placeholder?: string;
  requiredLike?: boolean;
};

const FIELDS: FieldDef[] = [
  { key: "slug", label: "Slug", type: "text", placeholder: "e.g. red-onion", requiredLike: true },
  { key: "cost", label: "Cost", type: "number", placeholder: "e.g. 0.95" },
  { key: "price", label: "Selling Price", type: "number", placeholder: "e.g. 1.25" },
  { key: "qty", label: "Stock Qty", type: "number", placeholder: "e.g. 24" },
  { key: "subsubcategory_id", label: "SubSubCategory ID", type: "number", placeholder: "e.g. 123" },
  { key: "tags", label: "Tags (comma separated)", type: "textarea", placeholder: "fresh, vegetable, mogadishu" },
];

function isMissingValue(value: any, def: FieldDef) {
  if (value === null || value === undefined) return true;
  if (def.type === "text" || def.type === "textarea") {
    const s = String(value).trim();
    if (s.length === 0) return true;
    if (def.requiredLike && s.length === 0) return true;
  }
  return false;
}

function toNumberOrNull(v: string) {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// tags is NOT NULL (array). If user leaves blank we still submit "" (as [""])
function toTagsArray(v: any): string[] {
  if (v === null || v === undefined) return [""];
  if (Array.isArray(v)) {
    const cleaned = v.map((x) => String(x).trim()).filter(Boolean);
    return cleaned.length ? cleaned : [""];
  }
  const s = String(v).trim();
  if (!s) return [""];
  const arr = s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return arr.length ? arr : [""];
}

async function convertToWebp(file: File): Promise<Blob> {
  const img = document.createElement("img");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const reader = new FileReader();
  const dataUrl: string = await new Promise((resolve) => {
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

  img.src = dataUrl;
  await new Promise((res) => (img.onload = res));

  canvas.width = img.width;
  canvas.height = img.height;
  ctx?.drawImage(img, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob as Blob), "image/webp", 0.9);
  });
}

export default function ProductFillCards() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [forms, setForms] = useState<Record<string, any>>({});
  const [showAllFields, setShowAllFields] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const TABLE = "products";
  const SELECT_COLS = "id,slug,qty,cost,price,tags,subsubcategory_id,img";

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from(TABLE)
        .select(SELECT_COLS)
        .order("updated_at", { ascending: false })
        .limit(200);

      if (!mounted) return;

      if (error) {
        setError(error.message);
        setProducts([]);
        setLoading(false);
        return;
      }

      const list = (data || []) as Product[];
      setProducts(list);

      // ✅ pulls existing DB values into the inputs
      const init: Record<string, any> = {};
      for (const p of list) {
        init[String(p.id)] = {
          slug: p.slug ?? "",
          qty: p.qty ?? null,
          cost: p.cost ?? null,
          price: p.price ?? null,
          tags: p.tags ?? [""], // NOT NULL fallback
          subsubcategory_id: p.subsubcategory_id ?? null,
          img: p.img ?? null,
        };
      }
      setForms(init);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const missingCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of products) {
      let c = 0;
      for (const def of FIELDS) {
        if (isMissingValue((p as any)[def.key], def)) c++;
      }
      map[String(p.id)] = c;
    }
    return map;
  }, [products]);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const ma = missingCounts[String(a.id)] ?? 0;
      const mb = missingCounts[String(b.id)] ?? 0;
      if (mb !== ma) return mb - ma;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [products, missingCounts]);

  function scrollToIndex(i: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const child = el.children[i] as HTMLElement | undefined;
    if (!child) return;
    child.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }

  async function saveProduct(product: Product, index: number) {
    const id = String(product.id);
    const form = forms[id] || {};

    setSavingId(id);
    setError(null);

    const patch: any = {};

    // slug
    const slug = typeof form.slug === "string" ? form.slug.trim() : "";
    patch.slug = slug === "" ? null : slug;

    // numbers
    const numKeys: (keyof Product)[] = ["qty", "cost", "price", "subsubcategory_id"];
    for (const k of numKeys) {
      const v = form[k];
      if (typeof v === "number") patch[k] = v;
      if (typeof v === "string") patch[k] = toNumberOrNull(v);
      if (v === null) patch[k] = null;
    }

    // tags (always submits "" if blank)
    patch.tags = toTagsArray(form.tags);

    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq("id", id)
      .select(SELECT_COLS)
      .single();

    if (error) {
      setError(error.message);
      setSavingId(null);
      return;
    }

    setProducts((prev) => prev.map((p) => (String(p.id) === id ? (data as Product) : p)));
    setSavingId(null);

    scrollToIndex(Math.min(index + 1, sortedProducts.length - 1));
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Product Fill</h2>
        <p style={{ opacity: 0.8 }}>Loading products…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Product Fill</h2>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Horizontal swipe → fill → Save → auto-next</div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={showAllFields} onChange={(e) => setShowAllFields(e.target.checked)} />
          Show all fields
        </label>
      </div>

      {error ? (
        <div style={{ background: "#fee2e2", color: "#7f1d1d", padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      ) : null}

      <div
        ref={scrollerRef}
        style={{
          display: "flex",
          gap: 14,
          overflowX: "auto",
          paddingBottom: 10,
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {sortedProducts.map((p, index) => {
          const id = String(p.id);
          const form = forms[id] || {};
          const missing = missingCounts[id] ?? 0;
          const isSaving = savingId === id;

          const fieldsToShow = FIELDS.filter((def) => {
            if (showAllFields) return true;
            return isMissingValue((p as any)[def.key], def);
          });

          return (
            <div
              key={id}
              style={{
                minWidth: 360,
                maxWidth: 360,
                flex: "0 0 auto",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 16,
                padding: 14,
                scrollSnapAlign: "start",
                background: "white",
              }}
            >
              {/* IMAGE */}
{/* IMAGE */}
<div style={{ marginBottom: 12 }}>
  {p.img ? (
    <img
      src={encodeURI(p.img)}
      alt={p.slug || "product"}
      style={{
        width: "100%",
        height: 220,
        objectFit: "contain",
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "white",
      }}
    />
  ) : (
    <div
      style={{
        width: "100%",
        height: 220,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        border: "1px dashed rgba(0,0,0,0.2)",
        fontSize: 13,
        opacity: 0.7,
        flexDirection: "column",
        gap: 8,
        background: "white",
      }}
    >
      No image
    </div>
  )}

  {/* Always show upload/replace */}
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginTop: 10,
    }}
  >
    <label
      style={{
        padding: "8px 12px",
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.15)",
        cursor: "pointer",
        fontWeight: 800,
        fontSize: 13,
        background: "#fff",
      }}
    >
      {p.img ? "Replace image" : "Upload image"}
      <input
        type="file"
        accept="image/*"
        style={{ display: "none" }}
onChange={async (e) => {
  const inputEl = e.currentTarget as HTMLInputElement | null;
  const file = inputEl?.files?.[0];
  if (!file) return;

  try {
    const webpBlob = await convertToWebp(file);

    const safeSlug = (p.slug || p.id)
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/(\d)\.(\d)/g, "$1$2")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const path = `products/${safeSlug || p.id}.webp`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, webpBlob, { upsert: true, contentType: "image/webp" });

    if (uploadError) throw uploadError;

    const publicUrl =
      `https://swrgqktuatubssvwjkyx.supabase.co/storage/v1/object/public/product-images/${path}`;

    const { error: updErr } = await supabase
      .from("products")
      .update({ img: publicUrl })
      .eq("id", p.id);

    if (updErr) throw updErr;

    setProducts((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, img: publicUrl } : x))
    );
  } catch (err: any) {
    setError(err?.message || "Upload failed");
  } finally {
    // reset input so selecting same file again works
    if (inputEl) inputEl.value = "";
  }
}}
      />
    </label>

    {p.img ? (
      <a
        href={p.img}
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: 12, fontWeight: 800, opacity: 0.75 }}
      >
        Open
      </a>
    ) : (
      <span style={{ fontSize: 12, opacity: 0.6 }}>
        Uploads to product-images/products/
      </span>
    )}
  </div>
</div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.slug || "(No slug yet)"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>ID: {id}</div>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    padding: "4px 8px",
                    borderRadius: 999,
                    border: "1px solid rgba(0,0,0,0.12)",
                    alignSelf: "flex-start",
                  }}
                >
                  Missing: {missing}
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {fieldsToShow.length === 0 ? (
                  <div style={{ fontSize: 13, opacity: 0.7, padding: "10px 0" }}>Nothing missing 🎉</div>
                ) : null}

                {fieldsToShow.map((def) => {
                  const val = (form as any)[def.key];

                  if (def.type === "textarea") {
                    return (
                      <div key={String(def.key)}>
                        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>{def.label}</div>
                        <textarea
                          value={
                            typeof val === "string"
                              ? val
                              : Array.isArray(val)
                                ? val.filter(Boolean).join(", ")
                                : val ?? ""
                          }
                          placeholder={def.placeholder}
                          rows={3}
                          style={{
                            width: "100%",
                            borderRadius: 12,
                            border: "1px solid rgba(0,0,0,0.12)",
                            padding: 10,
                            fontSize: 13,
                            resize: "vertical",
                          }}
                          onChange={(e) => setForms((prev) => ({ ...prev, [id]: { ...prev[id], [def.key]: e.target.value } }))}
                        />
                      </div>
                    );
                  }

                  const inputType = def.type === "number" ? "number" : "text";
                  const displayVal = val === null || val === undefined ? "" : String(val);

                  return (
                    <div key={String(def.key)}>
                      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>{def.label}</div>
                      <input
                        type={inputType}
                        inputMode={def.type === "number" ? "decimal" : undefined}
                        value={displayVal}
                        placeholder={def.placeholder}
                        style={{
                          width: "100%",
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.12)",
                          padding: "10px 12px",
                          fontSize: 13,
                        }}
                        onChange={(e) => setForms((prev) => ({ ...prev, [id]: { ...prev[id], [def.key]: e.target.value } }))}
                      />
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button
                  onClick={() => saveProduct(p, index)}
                  disabled={isSaving}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.12)",
                    fontWeight: 800,
                    cursor: isSaving ? "not-allowed" : "pointer",
                  }}
                >
                  {isSaving ? "Saving…" : "Save & Next →"}
                </button>

                <button
                  onClick={() => scrollToIndex(Math.max(index - 1, 0))}
                  style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", fontWeight: 800 }}
                  disabled={index === 0}
                >
                  ←
                </button>

                <button
                  onClick={() => scrollToIndex(Math.min(index + 1, sortedProducts.length - 1))}
                  style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", fontWeight: 800 }}
                  disabled={index === sortedProducts.length - 1}
                >
                  →
                </button>
              </div>

              <div style={{ fontSize: 11, opacity: 0.65, marginTop: 10 }}>Tip: scroll horizontally. Cards snap.</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}