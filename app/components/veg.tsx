"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type VegRow = {
  id: string;
  slug: string;
  price: number | null;
  cost: number | null;
  qty: number | null;
  is_weight: boolean | null;
  subsubcategory_id: number | null;
  created_at?: string;
};

function money(n: number) {
  if (!Number.isFinite(n)) return "$0";
  return `$${n.toFixed(2)}`;
}

export default function VegAdmin() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [rows, setRows] = useState<VegRow[]>([]);
  const [query, setQuery] = useState("");

  // Create form

  // Inline edits (id -> partial updates)
  const [edits, setEdits] = useState<Record<string, Partial<VegRow>>>({});

  async function load() {
    setLoading(true);
    setErrorMsg(null);

    // Veg = subsubcategory_id between 10101 and 10104 (inclusive)
    const { data, error } = await supabase
      .from("products")
      .select("id,slug,price,cost,qty,is_weight,subsubcategory_id,created_at")
      .gte("subsubcategory_id", 10101)
      .lte("subsubcategory_id", 10104)
      .order("slug", { ascending: true });

    if (error) {
      setErrorMsg(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.slug ?? "").toLowerCase().includes(q));
  }, [rows, query]);

  function getEditValue(id: string, key: keyof VegRow): any {
    const e = edits[id];
    if (e && key in e) return (e as any)[key];
    const r = rows.find((x) => x.id === id);
    return r ? (r as any)[key] : "";
  }

  function setEdit(id: string, patch: Partial<VegRow>) {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  }

  function isDirty(id: string) {
    return !!edits[id] && Object.keys(edits[id]).length > 0;
  }

  async function saveRow(id: string) {
    const patch = edits[id];
    if (!patch || Object.keys(patch).length === 0) return;

    setSavingId(id);
    setErrorMsg(null);

    const cost = patch.cost;
    const qty = patch.qty;
    const price = patch.price;
    const subsub = patch.subsubcategory_id;

    if (cost != null && (!Number.isFinite(Number(cost)) || Number(cost) < 0)) {
      setErrorMsg("Cost must be a number >= 0");
      setSavingId(null);
      return;
    }
    if (qty != null && (!Number.isFinite(Number(qty)) || Number(qty) < 0)) {
      setErrorMsg("Qty must be a number >= 0");
      setSavingId(null);
      return;
    }
    if (price != null && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
      setErrorMsg("Price must be a number >= 0");
      setSavingId(null);
      return;
    }
    if (subsub != null && (Number(subsub) < 10101 || Number(subsub) > 10104)) {
      setErrorMsg("Subsubcategory must be between 10101 and 10104");
      setSavingId(null);
      return;
    }

    const update: any = { ...patch };
    if (update.cost != null) update.cost = Number(update.cost);
    if (update.qty != null) update.qty = Number(update.qty);
    if (update.price != null) update.price = Number(update.price);
    if (update.subsubcategory_id != null) update.subsubcategory_id = Number(update.subsubcategory_id);

    const { data, error } = await supabase
      .from("products")
      .update(update)
      .eq("id", id)
      .select("id,slug,price,cost,qty,is_weight,subsubcategory_id,created_at")
      .single();

    if (error) {
      setErrorMsg(error.message);
      setSavingId(null);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === id ? (data as any) : r)));
    setEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSavingId(null);
  }

  async function deleteRow(id: string) {
    if (!confirm("Delete this veg item?")) return;
    setDeletingId(id);
    setErrorMsg(null);

    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      setErrorMsg(error.message);
      setDeletingId(null);
      return;
    }

    setRows((prev) => prev.filter((r) => r.id !== id));
    setEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setDeletingId(null);
  }



  const s: Record<string, React.CSSProperties> = {
    page: { padding: 14, maxWidth: 980, margin: "0 auto" },
    header: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 },
    titleRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
    },
    title: { fontSize: 18, fontWeight: 800 },
    small: { fontSize: 12, opacity: 0.75 },
    card: {
      background: "#fff",
      borderRadius: 14,
      border: "1px solid rgba(0,0,0,0.08)",
      padding: 12,
      boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
    },
    input: {
      width: "100%",
      padding: "10px 10px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,0.12)",
      outline: "none",
      fontSize: 14,
    },
    btn: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,0.12)",
      background: "#111",
      color: "#fff",
      fontWeight: 800,
      cursor: "pointer",
      width: "100%",
    },
    btnGhost: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,0.12)",
      background: "#fff",
      color: "#111",
      fontWeight: 800,
      cursor: "pointer",
      width: "100%",
    },
    btnDanger: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,0.12)",
      background: "#b91c1c",
      color: "#fff",
      fontWeight: 800,
      cursor: "pointer",
      width: "100%",
    },
    grid2: { display: "grid", gridTemplateColumns: "1fr", gap: 10 },
    rowCard: { background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", padding: 12 },
    rowTop: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 10,
      flexWrap: "wrap",
      marginBottom: 10,
    },
    slug: { fontWeight: 900, fontSize: 14 },
    pills: { display: "flex", gap: 8, flexWrap: "wrap" },
    pill: {
      fontSize: 12,
      padding: "4px 10px",
      borderRadius: 999,
      border: "1px solid rgba(0,0,0,0.12)",
      background: "rgba(0,0,0,0.03)",
    },
    formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "end" },
    label: { fontSize: 12, opacity: 0.75, marginBottom: 6 },
    actionsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 },
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.titleRow}>
          <div>
            <div style={s.title}>Veg Inventory</div>
            <div style={s.small}>
              View / add / edit / delete veg items (cost + qty). Vegs are products where subsubcategory_id is 10101–10104.
            </div>
          </div>
          <button style={{ ...s.btnGhost, width: 140 }} onClick={load} disabled={loading} title="Refresh">
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {errorMsg ? (
          <div style={{ ...s.card, borderColor: "rgba(185, 28, 28, 0.35)", background: "rgba(185, 28, 28, 0.06)" }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Error</div>
            <div style={{ fontSize: 13 }}>{errorMsg}</div>
          </div>
        ) : null}

     

        <div style={s.card}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Search</div>
          <input style={s.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search veg by name…" />
        </div>
      </div>

      {loading ? (
        <div style={s.card}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={s.card}>No veg items found. Add one above (they are products with subsubcategory_id 10101–10104).</div>
      ) : (
        <div style={s.grid2}>
          {filtered.map((r) => {
            const dirty = isDirty(r.id);
            const qtyVal = getEditValue(r.id, "qty");
            const costVal = getEditValue(r.id, "cost");
            const priceVal = getEditValue(r.id, "price");
            const isW = Boolean(getEditValue(r.id, "is_weight"));

            return (
              <div key={r.id} style={s.rowCard}>
                <div style={s.rowTop}>
                  <div>
                    <div style={s.slug}>{r.slug}</div>
                    <div style={s.pills}>
                      <span style={s.pill}>Cost: {money(Number(r.cost ?? 0))}</span>
                      <span style={s.pill}>
                        Qty: {Number(r.qty ?? 0).toFixed(isW ? 2 : 0)} {isW ? "kg" : "u"}
                      </span>
                      <span style={s.pill}>Type: {r.is_weight ? "Weighted" : "Unit"}</span>
                      <span style={s.pill}>SubSub: {r.subsubcategory_id ?? "—"}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>ID: {r.id.slice(0, 8)}…</div>
                </div>

                <div style={s.formGrid}>
                  <div style={{ gridColumn: "span 2" }}>
                    <div style={s.label}>Name</div>
                    <input style={s.input} value={getEditValue(r.id, "slug") ?? ""} onChange={(e) => setEdit(r.id, { slug: e.target.value })} />
                  </div>

                  <div>
                    <div style={s.label}>Cost</div>
                    <input
                      style={s.input}
                      value={costVal ?? ""}
                      onChange={(e) => setEdit(r.id, { cost: e.target.value === "" ? null : Number(e.target.value) })}
                      inputMode="decimal"
                    />
                  </div>

                  <div>
                    <div style={s.label}>Qty</div>
                    <input
                      style={s.input}
                      value={qtyVal ?? ""}
                      onChange={(e) => setEdit(r.id, { qty: e.target.value === "" ? null : Number(e.target.value) })}
                      inputMode="decimal"
                    />
                  </div>

                  <div>
                    <div style={s.label}>Price</div>
                    <input
                      style={s.input}
                      value={priceVal ?? ""}
                      onChange={(e) => setEdit(r.id, { price: e.target.value === "" ? null : Number(e.target.value) })}
                      inputMode="decimal"
                      placeholder="Optional"
                    />
                  </div>

           

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                      <input type="checkbox" checked={isW} onChange={(e) => setEdit(r.id, { is_weight: e.target.checked })} />
                      Weighted (kg)
                    </label>
                  </div>
                </div>

                <div style={s.actionsGrid}>
                  <button
                    style={{ ...s.btn, opacity: dirty ? 1 : 0.55 }}
                    onClick={() => saveRow(r.id)}
                    disabled={!dirty || savingId === r.id || deletingId === r.id}
                  >
                    {savingId === r.id ? "Saving…" : "Save"}
                  </button>
                  <button style={s.btnDanger} onClick={() => deleteRow(r.id)} disabled={savingId === r.id || deletingId === r.id}>
                    {deletingId === r.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7, textAlign: "center" }}>
        Tip: This page shows products where <b>subsubcategory_id</b> is between <b>10101</b> and <b>10104</b>.
      </div>
    </div>
  );
}