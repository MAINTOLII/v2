"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Custom.tsx
 *
 * ✅ Product Online Config editor (JSONB)
 * Stores all online quantity options + pricing in: products.online_config
 *
 * Supports:
 * - min / step (can be < 1, e.g. 0.25kg)
 * - unit (kg / pcs)
 * - exact options (e.g. 250g, 500g, 5 pcs)
 * - bulk tiers (e.g. 1–2, 3+)
 *
 * NOTE:
 * - This editor ALSO auto-cleans duplicates (same type+qty/min/max+unit_price)
 * - It does NOT use product_price_tiers table.
 */

type OnlineOption = {
  id: string;
  type: "exact" | "bulk";
  label: string;
  // exact
  qty?: number | null;
  // bulk
  min_qty?: number | null;
  max_qty?: number | null;
  unit_price: number;
};

type OnlineConfig = {
  unit: string;
  is_weight: boolean;
  min: number;
  step: number;
  options: OnlineOption[];
};

type ProductRow = {
  id: string;
  slug: string;
  price: number;
  is_weight: boolean;
  is_online: boolean;
  online_config: any;
};

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: 16,
    background: "#fafafa",
    minHeight: "100vh",
    color: "#111",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },
  container: { maxWidth: 1200, margin: "0 auto", display: "grid", gap: 14 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 22, fontWeight: 950, letterSpacing: "-0.02em" },
  subtitle: { margin: 0, fontSize: 13, opacity: 0.8 },

  shell: { display: "grid", gridTemplateColumns: "380px 1fr", gap: 12, alignItems: "start" },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 },
  divider: { height: 1, background: "#f1f5f9", border: 0, margin: "10px 0" },

  search: { height: 40, width: "100%", padding: "8px 10px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", fontSize: 14 },

  list: { display: "grid", gap: 8, maxHeight: "70vh", overflow: "auto" },
  row: { border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, cursor: "pointer", background: "#fff", display: "grid", gap: 6 },
  rowActive: { border: "1px solid #111" },
  slug: { margin: 0, fontWeight: 950 },
  small: { fontSize: 12, opacity: 0.8 },

  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  label: { fontSize: 12, fontWeight: 900, opacity: 0.85 },
  input: { height: 40, width: "100%", padding: "8px 10px", borderRadius: 12, border: "1px solid #e5e7eb", outline: "none", fontSize: 14, background: "#fff" },
  select: { height: 40, width: "100%", padding: "8px 10px", borderRadius: 12, border: "1px solid #e5e7eb", outline: "none", fontSize: 14, background: "#fff" },

  btnRow: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  btn: { height: 40, padding: "0 14px", borderRadius: 12, border: "1px solid #111", background: "#111", color: "#fff", fontWeight: 950, cursor: "pointer" },
  btnGhost: { height: 40, padding: "0 14px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", color: "#111", fontWeight: 950, cursor: "pointer" },
  btnDanger: { height: 40, padding: "0 14px", borderRadius: 12, border: "1px solid #f1c4c4", background: "#fff", color: "#b42318", fontWeight: 950, cursor: "pointer" },

  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
  th: { textAlign: "left", fontSize: 12, fontWeight: 950, opacity: 0.8, padding: "8px 6px" },
  td: { padding: "6px" },

  msgErr: { color: "#b42318", fontWeight: 900, fontSize: 13 },
  msgOk: { color: "#067647", fontWeight: 900, fontSize: 13 },
  code: { fontSize: 12, background: "#0b1020", color: "#e5e7eb", padding: 12, borderRadius: 12, overflow: "auto" },
};

function money(n: number) {
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

function parseNum(v: unknown): number {
  const s = String(v ?? "").trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function makeId() {
  return `opt_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function defaultConfigFor(p: ProductRow): OnlineConfig {
  const is_weight = !!p.is_weight;
  return {
    unit: is_weight ? "kg" : "pcs",
    is_weight,
    min: is_weight ? 0.5 : 1,
    step: is_weight ? 0.5 : 1,
    options: [],
  };
}

function normalizeOption(o: any): OnlineOption | null {
  const type = o?.type === "bulk" ? "bulk" : o?.type === "exact" ? "exact" : null;
  if (!type) return null;

  const label = String(o?.label ?? "").trim();
  if (!label) return null;

  const unit_price = parseNum(o?.unit_price);
  if (!Number.isFinite(unit_price) || unit_price < 0) return null;

  if (type === "exact") {
    const qty = parseNum(o?.qty);
    if (!Number.isFinite(qty) || qty <= 0) return null;
    return {
      id: String(o?.id || makeId()),
      type,
      label,
      qty,
      min_qty: null,
      max_qty: null,
      unit_price,
    };
  }

  // bulk
  const min_qty = parseNum(o?.min_qty);
  const max_qty = o?.max_qty == null || String(o?.max_qty).trim() === "" ? null : parseNum(o?.max_qty);

  if (!Number.isFinite(min_qty) || min_qty < 0) return null;
  if (max_qty != null && (!Number.isFinite(max_qty) || max_qty < min_qty)) return null;

  return {
    id: String(o?.id || makeId()),
    type,
    label,
    qty: null,
    min_qty,
    max_qty: max_qty ?? null,
    unit_price,
  };
}

function dedupeOptions(options: OnlineOption[]): OnlineOption[] {
  const seen = new Set<string>();
  const out: OnlineOption[] = [];
  for (const o of options) {
    const key = JSON.stringify({
      type: o.type,
      qty: o.type === "exact" ? Number(o.qty ?? 0) : null,
      min: o.type === "bulk" ? Number(o.min_qty ?? 0) : null,
      max: o.type === "bulk" ? (o.max_qty == null ? null : Number(o.max_qty)) : null,
      price: Number(o.unit_price),
      label: String(o.label).trim().toLowerCase(),
    });
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}

function normalizeConfig(raw: any, p: ProductRow): OnlineConfig {
  const base = defaultConfigFor(p);

  const unit = String(raw?.unit ?? base.unit);
  const is_weight = !!(raw?.is_weight ?? base.is_weight);

  const minRaw = parseNum(raw?.min);
  const stepRaw = parseNum(raw?.step);
  const min = Number.isFinite(minRaw) && minRaw > 0 ? minRaw : base.min;
  const step = Number.isFinite(stepRaw) && stepRaw > 0 ? stepRaw : base.step;

  const optionsRaw = Array.isArray(raw?.options) ? raw.options : [];
  const options = dedupeOptions(optionsRaw.map(normalizeOption).filter(Boolean) as OnlineOption[]);

  options.sort((a, b) => {
    if (a.type !== b.type) return a.type === "exact" ? -1 : 1;
    const av = a.type === "exact" ? Number(a.qty ?? 0) : Number(a.min_qty ?? 0);
    const bv = b.type === "exact" ? Number(b.qty ?? 0) : Number(b.min_qty ?? 0);
    return av - bv;
  });

  return { unit, is_weight, min, step, options };
}

function autoPresetWeight(cfg: OnlineConfig): OnlineConfig {
  // sensible defaults for Somali grocery weights
  // exact: 250g, 500g, 1kg | bulk: 1–2kg, 3kg+
  const next: OnlineConfig = {
    ...cfg,
    unit: "kg",
    is_weight: true,
    min: cfg.min > 0 ? cfg.min : 0.25,
    step: cfg.step > 0 ? cfg.step : 0.25,
  };

  const opts: OnlineOption[] = [
    { id: makeId(), type: "exact", label: "250g", qty: 0.25, unit_price: 0 },
    { id: makeId(), type: "exact", label: "500g", qty: 0.5, unit_price: 0 },
    { id: makeId(), type: "exact", label: "1kg", qty: 1, unit_price: 0 },
    { id: makeId(), type: "bulk", label: "1–2kg", min_qty: 1, max_qty: 2, unit_price: 0 },
    { id: makeId(), type: "bulk", label: "Bulk 3+", min_qty: 3, max_qty: null, unit_price: 0 },
  ];

  next.options = dedupeOptions([...(next.options ?? []), ...opts]);
  next.options = next.options.map((o) => ({ ...o, unit_price: Number.isFinite(o.unit_price) ? o.unit_price : 0 }));
  return next;
}

function autoPresetUnit(cfg: OnlineConfig): OnlineConfig {
  const next: OnlineConfig = {
    ...cfg,
    unit: "pcs",
    is_weight: false,
    min: cfg.min > 0 ? cfg.min : 1,
    step: cfg.step > 0 ? cfg.step : 1,
  };

  const opts: OnlineOption[] = [
    { id: makeId(), type: "bulk", label: "1–2", min_qty: 1, max_qty: 2, unit_price: 0 },
    { id: makeId(), type: "bulk", label: "Bulk 3+", min_qty: 3, max_qty: null, unit_price: 0 },
  ];

  next.options = dedupeOptions([...(next.options ?? []), ...opts]);
  next.options = next.options.map((o) => ({ ...o, unit_price: Number.isFinite(o.unit_price) ? o.unit_price : 0 }));
  return next;
}

export default function Custom() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [ok, setOk] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const [selectedId, setSelectedId] = useState<string>("");
  const selected = useMemo(() => products.find((p) => p.id === selectedId) ?? null, [products, selectedId]);

  const [draft, setDraft] = useState<OnlineConfig | null>(null);

  async function load() {
    setLoading(true);
    setErr("");
    setOk("");

    const { data, error } = await supabase
      .from("products")
      .select("id,slug,price,is_weight,is_online,online_config")
      .order("updated_at", { ascending: false });

    if (error) {
      setErr(error.message);
      setProducts([]);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as ProductRow[];
    setProducts(list);

    // keep selection if still exists
    if (selectedId && !list.some((p) => p.id === selectedId)) {
      setSelectedId("");
      setDraft(null);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // whenever selected changes, build draft
  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft(normalizeConfig(selected.online_config, selected));
  }, [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.slug.toLowerCase().includes(q));
  }, [products, search]);

  function updateDraft(partial: Partial<OnlineConfig>) {
    setDraft((prev) => {
      if (!prev) return prev;

      const next: OnlineConfig = { ...prev, ...partial };

      // Guard against NaN/invalid numeric edits (common when user clears input)
      if (partial.min !== undefined) {
        const v = Number(partial.min);
        next.min = Number.isFinite(v) && v > 0 ? v : prev.min;
      }
      if (partial.step !== undefined) {
        const v = Number(partial.step);
        next.step = Number.isFinite(v) && v > 0 ? v : prev.step;
      }

      // keep consistent with weight/unit
      if (next.is_weight && !next.unit) next.unit = "kg";
      if (!next.is_weight && !next.unit) next.unit = "pcs";

      return next;
    });
  }

  function updateOption(id: string, patch: Partial<OnlineOption>) {
    setDraft((prev) => {
      if (!prev) return prev;

      const options = prev.options.map((o) => {
        if (o.id !== id) return o;

        const next: OnlineOption = { ...o, ...patch } as OnlineOption;

        // Guard numeric fields
        if (patch.unit_price !== undefined) {
          const v = Number(patch.unit_price);
          next.unit_price = Number.isFinite(v) && v >= 0 ? v : o.unit_price;
        }

        if (next.type === "exact") {
          // exact uses qty only
          if (patch.qty !== undefined) {
            const v = Number(patch.qty);
            next.qty = Number.isFinite(v) && v > 0 ? v : o.qty ?? prev.min;
          }
          next.min_qty = null;
          next.max_qty = null;
        } else {
          // bulk uses min/max
          if (patch.min_qty !== undefined) {
            const v = Number(patch.min_qty);
            next.min_qty = Number.isFinite(v) && v >= 0 ? v : o.min_qty ?? prev.min;
          }
          if (patch.max_qty !== undefined) {
            // allow null (open ended)
            if (patch.max_qty == null) {
              next.max_qty = null;
            } else {
              const v = Number(patch.max_qty);
              next.max_qty = Number.isFinite(v) ? v : o.max_qty ?? null;
            }
          }
          next.qty = null;
        }

        return next;
      });

      return { ...prev, options: dedupeOptions(options) };
    });
  }

  function addOption(type: "exact" | "bulk") {
    setDraft((prev) => {
      if (!prev) return prev;
      const o: OnlineOption =
        type === "exact"
          ? { id: makeId(), type: "exact", label: "New option", qty: prev.min, unit_price: 0 }
          : { id: makeId(), type: "bulk", label: "Bulk", min_qty: prev.min, max_qty: null, unit_price: 0 };
      return { ...prev, options: dedupeOptions([...(prev.options ?? []), o]) };
    });
  }

  function deleteOption(id: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, options: prev.options.filter((o) => o.id !== id) };
    });
  }

  async function save() {
    setErr("");
    setOk("");
    if (!selected || !draft) return;

    // final clean
    const clean: OnlineConfig = {
      unit: String(draft.unit || (draft.is_weight ? "kg" : "pcs")),
      is_weight: !!draft.is_weight,
      min: Number.isFinite(Number(draft.min)) && Number(draft.min) > 0 ? Number(draft.min) : (draft.is_weight ? 0.5 : 1),
      step: Number.isFinite(Number(draft.step)) && Number(draft.step) > 0 ? Number(draft.step) : (draft.is_weight ? 0.5 : 1),
      options: dedupeOptions(
        (draft.options ?? [])
          .map((o) => normalizeOption(o))
          .filter(Boolean) as OnlineOption[]
      ),
    };

    clean.options.sort((a, b) => {
      if (a.type !== b.type) return a.type === "exact" ? -1 : 1;
      const av = a.type === "exact" ? Number(a.qty ?? 0) : Number(a.min_qty ?? 0);
      const bv = b.type === "exact" ? Number(b.qty ?? 0) : Number(b.min_qty ?? 0);
      return av - bv;
    });

    const { error } = await supabase.from("products").update({ online_config: clean }).eq("id", selected.id);

    if (error) {
      setErr(error.message);
      return;
    }

    setOk("Saved ✅");
    await load();
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <div>
            <h1 style={s.title}>Custom (Online Options Editor)</h1>
            <p style={s.subtitle}>Edit products.online_config (min/step/options/prices). Duplicates are auto-removed.</p>
          </div>
          <div style={s.btnRow}>
            <button style={s.btnGhost} type="button" onClick={load}>
              Refresh
            </button>
          </div>
        </header>

        {err ? (
          <div style={{ ...s.card, borderColor: "#f1c4c4" }}>
            <div style={s.msgErr}>{err}</div>
          </div>
        ) : null}

        {ok ? (
          <div style={{ ...s.card, borderColor: "#c7f0d1" }}>
            <div style={s.msgOk}>{ok}</div>
          </div>
        ) : null}

        <div style={s.shell}>
          {/* LEFT: product list */}
          <section style={s.card}>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 950 }}>Products</div>
              <input style={s.search} placeholder="Search slug…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <hr style={s.divider} />

              {loading ? <div style={s.small}>Loading…</div> : null}

              <div style={s.list}>
                {filtered.map((p) => {
                  const active = p.id === selectedId;
                  return (
                    <div
                      key={p.id}
                      style={{ ...s.row, ...(active ? s.rowActive : {}) }}
                      onClick={() => {
                        setSelectedId(p.id);
                        setOk("");
                        setErr("");
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <p style={s.slug}>{p.slug}</p>
                      <div style={s.small}>
                        Base price: <b>{money(Number(p.price) || 0)}</b> · {p.is_weight ? "weight" : "unit"} · online: {p.is_online ? "yes" : "no"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* RIGHT: editor */}
          <section style={s.card}>
            {!selected || !draft ? (
              <div style={{ opacity: 0.8 }}>Select a product on the left.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 1000, fontSize: 18 }}>{selected.slug}</div>
                    <div style={s.small}>Base price (fallback if no match): {money(Number(selected.price) || 0)}</div>
                  </div>
                  <div style={s.btnRow}>
                    <button
                      style={s.btnGhost}
                      type="button"
                      onClick={() => {
                        setDraft((prev) => (prev ? autoPresetWeight(prev) : prev));
                        setOk("");
                        setErr("");
                      }}
                    >
                      Add weight presets
                    </button>
                    <button
                      style={s.btnGhost}
                      type="button"
                      onClick={() => {
                        setDraft((prev) => (prev ? autoPresetUnit(prev) : prev));
                        setOk("");
                        setErr("");
                      }}
                    >
                      Add unit presets
                    </button>
                    <button style={s.btn} type="button" onClick={save}>
                      Save
                    </button>
                  </div>
                </div>

                <hr style={s.divider} />

                <div style={s.grid2}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={s.label}>Unit</div>
                    <input
                      style={s.input}
                      placeholder="kg / pcs"
                      value={draft.unit}
                      onChange={(e) => updateDraft({ unit: e.target.value })}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={s.label}>Is weight?</div>
                    <select
                      style={s.select}
                      value={draft.is_weight ? "yes" : "no"}
                      onChange={(e) => updateDraft({ is_weight: e.target.value === "yes" })}
                    >
                      <option value="no">No (units)</option>
                      <option value="yes">Yes (weight)</option>
                    </select>
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={s.label}>Minimum qty</div>
                    <input
                      style={s.input}
                      type="number"
                      step="0.01"
                      value={String(draft.min)}
                      onChange={(e) => updateDraft({ min: parseNum(e.target.value) })}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={s.label}>Step</div>
                    <input
                      style={s.input}
                      type="number"
                      step="0.01"
                      value={String(draft.step)}
                      onChange={(e) => updateDraft({ step: parseNum(e.target.value) })}
                    />
                  </div>
                </div>

                <div style={s.btnRow}>
                  <button style={s.btnGhost} type="button" onClick={() => addOption("exact")}>
                    + Add exact option
                  </button>
                  <button style={s.btnGhost} type="button" onClick={() => addOption("bulk")}>
                    + Add bulk tier
                  </button>
                  <button
                    style={s.btnDanger}
                    type="button"
                    onClick={() => {
                      setDraft((prev) => (prev ? { ...prev, options: [] } : prev));
                      setOk("");
                      setErr("");
                    }}
                  >
                    Clear options
                  </button>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Type</th>
                        <th style={s.th}>Label</th>
                        <th style={s.th}>Qty / Min</th>
                        <th style={s.th}>Max (bulk)</th>
                        <th style={s.th}>Unit price</th>
                        <th style={s.th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.options.map((o) => (
                        <tr key={o.id}>
                          <td style={s.td}>
                            <select
                              style={s.select}
                              value={o.type}
                              onChange={(e) => updateOption(o.id, { type: e.target.value as any })}
                            >
                              <option value="exact">exact</option>
                              <option value="bulk">bulk</option>
                            </select>
                          </td>
                          <td style={s.td}>
                            <input
                              style={s.input}
                              value={o.label}
                              onChange={(e) => updateOption(o.id, { label: e.target.value })}
                            />
                          </td>

                          <td style={s.td}>
                            {o.type === "exact" ? (
                              <input
                                style={s.input}
                                type="number"
                                step="0.01"
                                value={o.qty ?? ""}
                                onChange={(e) => updateOption(o.id, { qty: parseNum(e.target.value) })}
                              />
                            ) : (
                              <input
                                style={s.input}
                                type="number"
                                step="0.01"
                                value={o.min_qty ?? ""}
                                onChange={(e) => updateOption(o.id, { min_qty: parseNum(e.target.value) })}
                              />
                            )}
                          </td>

                          <td style={s.td}>
                            {o.type === "bulk" ? (
                              <input
                                style={s.input}
                                type="number"
                                step="0.01"
                                placeholder="(optional)"
                                value={o.max_qty ?? ""}
                                onChange={(e) => {
                                  const raw = String(e.target.value ?? "").trim();
                                  updateOption(o.id, { max_qty: raw === "" ? null : parseNum(raw) });
                                }}
                              />
                            ) : (
                              <div style={{ ...s.small, padding: "0 4px" }}>—</div>
                            )}
                          </td>

                          <td style={s.td}>
                            <input
                              style={s.input}
                              type="number"
                              step="0.01"
                              value={o.unit_price}
                              onChange={(e) => updateOption(o.id, { unit_price: parseNum(e.target.value) })}
                            />
                          </td>

                          <td style={s.td}>
                            <button style={s.btnDanger} type="button" onClick={() => deleteOption(o.id)}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 950 }}>Preview JSON (what will be saved)</div>
                  <pre style={s.code}>{JSON.stringify(draft, null, 2)}</pre>
                  <div style={s.small}>
                    Tip: For <b>exact</b> options, set <code>qty</code> (e.g. 0.25) and a clear label like “250g”.
                    For <b>bulk</b> tiers, set <code>min_qty</code> and optional <code>max_qty</code> (leave blank for open-ended),
                    plus the unit price.
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}