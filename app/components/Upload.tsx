"use client";

import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../../lib/supabase";

/**
 * Upload.tsx
 *
 * Upload an Excel (.xlsx/.xls) file and bulk insert/update rows into `public.products`.
 *
 * Columns supported (case-insensitive):
 * - slug (required)
 * - qty, cost, price, mrp
 * - tags (comma-separated OR JSON array)
 * - is_weight, is_online (true/false/1/0/yes/no)
 * - subsubcategory_id
 * - min_order_qty, qty_step
 * - online_config (JSON string or object)
 *
 * Behavior:
 * - If a row's slug already exists, we UPDATE it.
 * - Otherwise we INSERT it.
 *
 * NOTE: Requires `xlsx` package: npm i xlsx
 */

type ProductUpsert = {
  slug: string;
  qty?: number;
  cost?: number;
  price?: number;
  mrp?: number;
  tags?: string[];
  is_weight?: boolean;
  is_online?: boolean;
  subsubcategory_id?: number | null;
  min_order_qty?: number | null;
  qty_step?: number | null;
  online_config?: any;
};

type ParseResult = {
  rows: ProductUpsert[];
  errors: string[];
};

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: 16,
    background: "#fafafa",
    minHeight: "100vh",
    color: "#111",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "grid",
    gap: 12,
  },
  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 14,
  },
  title: { margin: 0, fontSize: 20, fontWeight: 950 },
  sub: { margin: 0, marginTop: 4, fontSize: 13, opacity: 0.75 },
  row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  input: {
    height: 40,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
  },
  btn: {
    height: 40,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnGhost: {
    height: 40,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnDanger: {
    height: 40,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b42318",
    fontWeight: 900,
    cursor: "pointer",
  },
  err: { color: "#b42318", fontWeight: 900, fontSize: 13 },
  ok: { color: "#067647", fontWeight: 900, fontSize: 13 },
  small: { fontSize: 12, opacity: 0.75 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" },
  td: { padding: "10px 8px", borderBottom: "1px solid #f3f4f6", verticalAlign: "top" },
  code: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
};

function toKey(s: unknown) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function parseBool(v: unknown): boolean | undefined {
  if (v == null) return undefined;
  const s = String(v).trim().toLowerCase();
  if (!s) return undefined;
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return undefined;
}

function parseNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  const s = String(v).trim().replace(",", ".");
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function parseIntMaybe(v: unknown): number | null | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

function parseTags(v: unknown): string[] | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) return v.map((x) => String(x)).map((x) => x.trim()).filter(Boolean);
  const raw = String(v).trim();
  if (!raw) return undefined;
  // allow JSON array
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.map((x) => String(x)).map((x) => x.trim()).filter(Boolean);
    } catch {
      // fallthrough
    }
  }
  // comma-separated
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseJson(v: unknown): any {
  if (v == null) return undefined;
  if (typeof v === "object") return v;
  const raw = String(v).trim();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function parseExcel(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = reader.result as ArrayBuffer;
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const rows: ProductUpsert[] = [];
        const errors: string[] = [];

        for (let i = 0; i < json.length; i++) {
          const rawRow = json[i] ?? {};

          // normalize keys
          const r: Record<string, any> = {};
          for (const k of Object.keys(rawRow)) {
            r[toKey(k)] = rawRow[k];
          }

          const slug = String(r.slug ?? r.product ?? r.name ?? "").trim();
          if (!slug) {
            errors.push(`Row ${i + 2}: missing slug`);
            continue;
          }

          const item: ProductUpsert = { slug };

          const qty = parseNum(r.qty);
          const cost = parseNum(r.cost);
          const price = parseNum(r.price);
          const mrp = parseNum(r.mrp);

          if (qty !== undefined) item.qty = qty;
          if (cost !== undefined) item.cost = cost;
          if (price !== undefined) item.price = price;
          if (mrp !== undefined) item.mrp = mrp;

          const tags = parseTags(r.tags);
          if (tags !== undefined) item.tags = tags;

          const is_weight = parseBool(r.is_weight);
          const is_online = parseBool(r.is_online);
          if (is_weight !== undefined) item.is_weight = is_weight;
          if (is_online !== undefined) item.is_online = is_online;

          const subsubcategory_id = parseIntMaybe(r.subsubcategory_id);
          if (subsubcategory_id !== undefined) item.subsubcategory_id = subsubcategory_id;

          const min_order_qty = parseNum(r.min_order_qty);
          const qty_step = parseNum(r.qty_step);
          if (min_order_qty !== undefined) item.min_order_qty = min_order_qty;
          if (qty_step !== undefined) item.qty_step = qty_step;

          const online_config = parseJson(r.online_config);
          if (online_config !== undefined) item.online_config = online_config;

          rows.push(item);
        }

        resolve({ rows, errors });
      } catch (e: any) {
        resolve({ rows: [], errors: [e?.message ?? "Failed to parse Excel"] });
      }
    };
    reader.onerror = () => resolve({ rows: [], errors: ["Failed to read file"] });
    reader.readAsArrayBuffer(file);
  });
}

export default function Upload() {
  const [fileName, setFileName] = useState<string>("");
  const [parsed, setParsed] = useState<ProductUpsert[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const sampleHeaders = useMemo(
    () =>
      [
        "slug",
        "qty",
        "cost",
        "price",
        "mrp",
        "tags",
        "is_weight",
        "is_online",
        "subsubcategory_id",
        "min_order_qty",
        "qty_step",
        "online_config",
      ],
    []
  );

  async function onPickFile(f: File | null) {
    setOk("");
    setErr("");
    setParseErrors([]);
    setParsed([]);

    if (!f) return;

    setFileName(f.name);
    const res = await parseExcel(f);
    setParsed(res.rows);
    setParseErrors(res.errors);
  }

  async function uploadToDb() {
    setOk("");
    setErr("");

    if (parsed.length === 0) {
      setErr("No rows to upload.");
      return;
    }

    setBusy(true);
    try {
      // Upsert by slug (unique)
      // IMPORTANT: Only include fields that are present to avoid overwriting with undefined.
      const payload = parsed.map((r) => {
        const out: any = { slug: r.slug };
        if (r.qty !== undefined) out.qty = r.qty;
        if (r.cost !== undefined) out.cost = r.cost;
        if (r.price !== undefined) out.price = r.price;
        if (r.mrp !== undefined) out.mrp = r.mrp;
        if (r.tags !== undefined) out.tags = r.tags;
        if (r.is_weight !== undefined) out.is_weight = r.is_weight;
        if (r.is_online !== undefined) out.is_online = r.is_online;
        if (r.subsubcategory_id !== undefined) out.subsubcategory_id = r.subsubcategory_id;
        if (r.min_order_qty !== undefined) out.min_order_qty = r.min_order_qty;
        if (r.qty_step !== undefined) out.qty_step = r.qty_step;
        if (r.online_config !== undefined) out.online_config = r.online_config;
        return out;
      });

      const { error } = await supabase.from("products").upsert(payload, { onConflict: "slug" });
      if (error) throw error;

      setOk(`Uploaded ✅ Rows: ${payload.length}`);
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFileName("");
    setParsed([]);
    setParseErrors([]);
    setOk("");
    setErr("");
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <section style={s.card}>
          <h1 style={s.title}>Upload Products (Excel)</h1>
          <p style={s.sub}>
            Upload an <b>.xlsx</b> file and it will <b>insert/update</b> rows in <span style={s.code}>public.products</span>.
          </p>

          <div style={{ ...s.row, marginTop: 10 }}>
            <input
              style={s.input}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            <button style={s.btn} type="button" onClick={uploadToDb} disabled={busy || parsed.length === 0}>
              {busy ? "Uploading…" : "Upload to DB"}
            </button>
            <button style={s.btnGhost} type="button" onClick={reset} disabled={busy}>
              Clear
            </button>
          </div>

          {fileName ? <div style={{ marginTop: 8, ...s.small }}>File: {fileName}</div> : null}

          {err ? (
            <div style={{ marginTop: 10, ...s.err }}>{err}</div>
          ) : ok ? (
            <div style={{ marginTop: 10, ...s.ok }}>{ok}</div>
          ) : null}

          {parseErrors.length ? (
            <div style={{ marginTop: 10 }}>
              <div style={s.err}>Parse issues:</div>
              <ul style={{ marginTop: 6 }}>
                {parseErrors.slice(0, 20).map((e, i) => (
                  <li key={i} style={s.small}>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section style={s.card}>
          <div style={{ fontWeight: 950, marginBottom: 8 }}>Expected headers</div>
          <div style={s.small}>
            Use these column names in row 1 (case-insensitive). Only <b>slug</b> is required.
          </div>
          <pre style={{ ...s.card, marginTop: 10, background: "#0b1020", color: "#e5e7eb", overflow: "auto" }}>
{sampleHeaders.join("\n")}
          </pre>
        </section>

        <section style={s.card}>
          <div style={{ fontWeight: 950, marginBottom: 8 }}>Preview ({parsed.length} rows)</div>
          {parsed.length === 0 ? (
            <div style={s.small}>Upload a file to preview rows here.</div>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>slug</th>
                    <th style={s.th}>qty</th>
                    <th style={s.th}>cost</th>
                    <th style={s.th}>price</th>
                    <th style={s.th}>mrp</th>
                    <th style={s.th}>is_weight</th>
                    <th style={s.th}>is_online</th>
                    <th style={s.th}>subsubcategory_id</th>
                    <th style={s.th}>min_order_qty</th>
                    <th style={s.th}>qty_step</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 50).map((r, idx) => (
                    <tr key={`${r.slug}_${idx}`}>
                      <td style={s.td}>
                        <b>{r.slug}</b>
                      </td>
                      <td style={s.td}>{r.qty ?? ""}</td>
                      <td style={s.td}>{r.cost ?? ""}</td>
                      <td style={s.td}>{r.price ?? ""}</td>
                      <td style={s.td}>{r.mrp ?? ""}</td>
                      <td style={s.td}>{String(r.is_weight ?? "")}</td>
                      <td style={s.td}>{String(r.is_online ?? "")}</td>
                      <td style={s.td}>{r.subsubcategory_id ?? ""}</td>
                      <td style={s.td}>{r.min_order_qty ?? ""}</td>
                      <td style={s.td}>{r.qty_step ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 50 ? <div style={{ marginTop: 8, ...s.small }}>Showing first 50 rows…</div> : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
