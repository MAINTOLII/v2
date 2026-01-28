

 
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type ProductRow = {
  id: string;
  slug: string;
  qty: number | null;
  cost: number | null;
};

type Line = {
  key: string;
  slug: string;
  qty: string;
  unitCost: string;
};

function money(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return `$${v.toFixed(2)}`;
}

function parseNum(v: unknown): number {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : NaN;
}

function safeKey() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: 14, maxWidth: 640, margin: "0 auto" },
  title: { margin: "0 0 12px 0", fontSize: 18, fontWeight: 900 },
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    background: "#fff",
    padding: 14,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 90px 110px 44px",
    gap: 10,
    alignItems: "center",
  },
  input: {
    height: 44,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    outline: "none",
    width: "100%",
    fontSize: 14,
  },
  plus: {
    height: 44,
    width: 44,
    borderRadius: 12,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 900,
    fontSize: 20,
    cursor: "pointer",
  },
  xBtn: {
    height: 44,
    width: 44,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    fontWeight: 900,
    fontSize: 18,
    cursor: "pointer",
  },
  total: { marginTop: 14, fontWeight: 900 },
  textarea: {
    marginTop: 12,
    height: 90,
    padding: 10,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    width: "100%",
    resize: "vertical",
  },
  btn: {
    marginTop: 12,
    height: 44,
    padding: "0 16px",
    borderRadius: 12,
    border: "1px solid #0B6EA9",
    background: "#0B6EA9",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  invoice: {
    marginTop: 20,
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 14,
    background: "#f8fafc",
    whiteSpace: "pre-wrap",
    fontFamily: "monospace",
    fontSize: 12,
  },
};

export default function In() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [lines, setLines] = useState<Line[]>([
    { key: safeKey(), slug: "", qty: "", unitCost: "" },
  ]);
  const [comments, setComments] = useState("");
  const [invoiceDate] = useState(todayISO());

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  async function saveToDatabase() {
    if (saving) return;
    setSaving(true);
    setSaveMsg(null);

    try {
      // Filter valid lines
      const validLines = lines.filter((l) => {
        const q = parseNum(l.qty);
        const c = parseNum(l.unitCost);
        return l.slug && Number.isFinite(q) && q > 0 && Number.isFinite(c) && c >= 0;
      });

      if (!validLines.length) {
        setSaveMsg("No valid lines to save.");
        setSaving(false);
        return;
      }

      // Create invoice first
      const { data: invoiceRow, error: invErr } = await supabase
        .from("invoices")
        .insert({
          invoice_date: invoiceDate,
          total_amount: total,
          comments: comments || null,
        })
        .select("id")
        .single();

      if (invErr || !invoiceRow?.id) {
        throw new Error(invErr?.message || "Failed to create invoice");
      }

      const invoiceId = invoiceRow.id;

      for (const l of validLines) {
        const product = products.find((p) => p.slug === l.slug);
        if (!product) continue;

        const qty = parseNum(l.qty);
        const cost = parseNum(l.unitCost);
        const newQty = Number(product.qty ?? 0) + qty;

        // Insert invoice item (link product to invoice)
        await supabase.from("invoice_items").insert({
          invoice_id: invoiceId,
          product_id: product.id,
          qty: qty,
          unit_cost: cost,
          line_total: Number((qty * cost).toFixed(2)),
        });

        // Insert movement
        await supabase.from("inventory_movements").insert({
          product_id: product.id,
          movement_type: "in",
          qty_delta: qty,
          unit_cost: cost,
          new_qty: newQty,
          new_cost: cost,
          source: "stock",
          note: `Invoice ${invoiceId}`,
        });

        // Update product qty + cost
        await supabase
          .from("products")
          .update({ qty: newQty, cost: cost })
          .eq("id", product.id);
      }

      setSaveMsg("Saved successfully.");
      setLines([{ key: safeKey(), slug: "", qty: "", unitCost: "" }]);
      setComments("");
    } catch (e: any) {
      setSaveMsg(e?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("products")
        .select("id,slug,qty,cost")
        .order("slug", { ascending: true })
        .limit(5000);
      setProducts((data ?? []) as any);
    }
    load();
  }, []);

  const productSlugs = useMemo(() => {
    return products.map((p) => p.slug).filter(Boolean);
  }, [products]);

  function updateLine(key: string, field: keyof Line, value: string) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [field]: value } : l))
    );
  }

  function addLine() {
    setLines((prev) => [...prev, { key: safeKey(), slug: "", qty: "", unitCost: "" }]);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  const total = useMemo(() => {
    return lines.reduce((sum, l) => {
      const q = parseNum(l.qty);
      const c = parseNum(l.unitCost);
      if (Number.isFinite(q) && Number.isFinite(c)) {
        return sum + q * c;
      }
      return sum;
    }, 0);
  }, [lines]);

  const invoiceText = useMemo(() => {
    const body = lines
      .filter((l) => l.slug)
      .map((l, i) => {
        const q = parseNum(l.qty);
        const c = parseNum(l.unitCost);
        const lineTotal = Number.isFinite(q) && Number.isFinite(c) ? q * c : 0;
        return `${i + 1}. ${l.slug}\n   Qty: ${q || 0} × ${money(c || 0)} = ${money(lineTotal)}`;
      })
      .join("\n");

    return `MATO Inventory Invoice\nDate: ${invoiceDate}\n\n${body}\n\nTOTAL: ${money(total)}\n\nComments:\n${comments || "-"}`;
  }, [lines, total, comments, invoiceDate]);

  return (
    <div style={s.page}>
      <h2 style={s.title}>Inventory In</h2>

      <div style={s.card}>
        <datalist id="products-list">
          {productSlugs.map((slug) => (
            <option key={slug} value={slug} />
          ))}
        </datalist>

        {lines.map((l, idx) => (
          <div key={l.key} style={{ marginBottom: 10 }}>
            <div style={s.row}>
              <input
                list="products-list"
                placeholder="Product name"
                value={l.slug}
                onChange={(e) => updateLine(l.key, "slug", e.target.value)}
                style={s.input}
              />

              <input
                placeholder="Qty"
                value={l.qty}
                onChange={(e) => updateLine(l.key, "qty", e.target.value)}
                style={s.input}
              />

              <input
                placeholder="Cost"
                value={l.unitCost}
                onChange={(e) => updateLine(l.key, "unitCost", e.target.value)}
                style={s.input}
              />

              {idx === lines.length - 1 ? (
                <button type="button" style={s.plus} onClick={addLine}>
                  +
                </button>
              ) : (
                <button type="button" style={s.xBtn} onClick={() => removeLine(l.key)}>
                  ×
                </button>
              )}
            </div>
          </div>
        ))}

        <div style={s.total}>Total: {money(total)}</div>

        <textarea
          style={s.textarea}
          placeholder="Comments (optional)…"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            style={s.btn}
            disabled={saving}
            onClick={saveToDatabase}
          >
            {saving ? "Saving..." : "Save"}
          </button>

          <button
            type="button"
            style={{ ...s.btn, background: "#111", border: "1px solid #111" }}
            onClick={() => navigator.clipboard.writeText(invoiceText)}
          >
            Copy Invoice
          </button>
        </div>

        {saveMsg ? (
          <div style={{ marginTop: 10, fontWeight: 700 }}>
            {saveMsg}
          </div>
        ) : null}
      </div>

      <div style={s.invoice}>{invoiceText}</div>
    </div>
  );
}