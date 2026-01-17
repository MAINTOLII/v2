"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type ProductRow = {
  id: string;
  slug: string;
  qty: number;
  cost: number;
};

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (!t.length) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

function formatNum(n: number) {
  if (!Number.isFinite(n)) return "0";
  // keep it clean for stock counting
  const s = String(n);
  return s;
}

export default function QtyCost() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [q, setQ] = useState("");

  // edits keyed by product id
  const [edits, setEdits] = useState<Record<string, { qty?: string; cost?: string }>>({});

  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // autofocus for fast counting
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  async function loadProducts() {
    setLoading(true);
    setErr(null);
    try {
      const res = await supabase
        .from("products")
        .select("id,slug,qty,cost")
        .order("slug", { ascending: true })
        .limit(5000);

      if (res.error) throw res.error;

      const rows = (res.data ?? []) as any[];
      setProducts(
        rows
          .filter((r) => !!r.id)
          .map((r) => ({
            id: String(r.id),
            slug: String(r.slug ?? ""),
            qty: Number(r.qty ?? 0),
            cost: Number(r.cost ?? 0),
          }))
      );
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return products.slice(0, 60);
    // fast filter by slug
    return products
      .filter((p) => (p.slug ?? "").toLowerCase().includes(qq))
      .slice(0, 120);
  }, [products, q]);

  function getEdit(id: string) {
    return edits[id] ?? {};
  }

  function getDisplayQty(p: ProductRow) {
    const e = edits[p.id];
    return e?.qty ?? formatNum(p.qty);
  }

  function getDisplayCost(p: ProductRow) {
    const e = edits[p.id];
    return e?.cost ?? formatNum(p.cost);
  }

  const dirtyIds = useMemo(() => {
    const ids: string[] = [];
    for (const p of filtered) {
      const e = edits[p.id];
      if (!e) continue;
      const nq = e.qty != null ? numOrNull(e.qty) : null;
      const nc = e.cost != null ? numOrNull(e.cost) : null;

      const qtyDirty = e.qty != null && nq != null && nq !== p.qty;
      const costDirty = e.cost != null && nc != null && nc !== p.cost;

      if (qtyDirty || costDirty) ids.push(p.id);
    }
    return ids;
  }, [edits, filtered]);

  async function saveOne(p: ProductRow) {
    setErr(null);

    const e = edits[p.id];
    const nextQty = e?.qty != null ? numOrNull(e.qty) : null;
    const nextCost = e?.cost != null ? numOrNull(e.cost) : null;

    // If user didn't change anything, do nothing
    const qtyChanged = nextQty != null && nextQty !== p.qty;
    const costChanged = nextCost != null && nextCost !== p.cost;

    if (!qtyChanged && !costChanged) {
      // clear harmless edits to keep UI clean
      setEdits((prev) => {
        const cp = { ...prev };
        delete cp[p.id];
        return cp;
      });
      return;
    }

    // Validate
    if (qtyChanged && (nextQty as number) < 0) {
      setErr("Qty cannot be negative");
      return;
    }
    if (costChanged && (nextCost as number) < 0) {
      setErr("Cost cannot be negative");
      return;
    }

    setSaving((prev) => ({ ...prev, [p.id]: true }));

    try {
      const payload: any = {};
      if (qtyChanged) payload.qty = nextQty;
      if (costChanged) payload.cost = nextCost;

      const res = await supabase.from("products").update(payload).eq("id", p.id);
      if (res.error) throw res.error;

      // update local list
      setProducts((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, qty: qtyChanged ? (nextQty as number) : x.qty, cost: costChanged ? (nextCost as number) : x.cost } : x))
      );

      // clear edits for this row
      setEdits((prev) => {
        const cp = { ...prev };
        delete cp[p.id];
        return cp;
      });
    } catch (e2: any) {
      setErr(e2?.message ?? String(e2));
    } finally {
      setSaving((prev) => {
        const cp = { ...prev };
        delete cp[p.id];
        return cp;
      });
    }
  }

  async function saveAll() {
    if (dirtyIds.length === 0) return;
    // Save sequentially to avoid rate limits and keep UI stable
    for (const id of dirtyIds) {
      const p = products.find((x) => x.id === id);
      if (!p) continue;
      // eslint-disable-next-line no-await-in-loop
      await saveOne(p);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-base font-extrabold">Qty / Cost quick edit</div>
          <div className="text-xs text-gray-500">Search by slug, then update qty and/or cost. Press Enter on a row to save.</div>
        </div>

        <div className="flex w-full md:w-auto items-center gap-2">
          <button
            type="button"
            onClick={loadProducts}
            className="h-10 w-full md:w-auto rounded-2xl border border-gray-200 bg-white px-3 text-sm font-extrabold text-gray-900 shadow-sm active:scale-[0.99]"
            disabled={loading}
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={saveAll}
            className="h-10 w-full md:w-auto rounded-2xl bg-[#0B6EA9] px-3 text-sm font-extrabold text-white shadow-sm active:scale-[0.99] disabled:opacity-50"
            disabled={dirtyIds.length === 0}
            title={dirtyIds.length === 0 ? "No changes" : `Save ${dirtyIds.length} changes`}
          >
            Save all ({dirtyIds.length})
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
          <div className="text-xs font-extrabold text-gray-700">Search</div>
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type product slug… (scanner also works)"
            className="mt-2 h-11 w-full rounded-2xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#0B6EA9] focus:ring-2 focus:ring-[#0B6EA9]/20"
          />
          <div className="mt-2 text-xs text-gray-500">Showing {filtered.length} results</div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="hidden md:grid grid-cols-12 gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-extrabold text-gray-600">
            <div className="col-span-6">Product</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-2 text-right">Cost</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          {loading ? (
            <div className="p-4 text-sm text-gray-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No results.</div>
          ) : (
            <div className="max-h-[70vh] overflow-auto md:overflow-auto">
              {filtered.map((p) => {
                const e = getEdit(p.id);
                const isRowSaving = !!saving[p.id];

                const qtyVal = getDisplayQty(p);
                const costVal = getDisplayCost(p);

                const qtyNum = numOrNull(qtyVal);
                const costNum = numOrNull(costVal);

                const qtyBad = qtyVal.trim().length > 0 && qtyNum === null;
                const costBad = costVal.trim().length > 0 && costNum === null;

                const qtyChanged = qtyNum != null && qtyNum !== p.qty;
                const costChanged = costNum != null && costNum !== p.cost;
                const rowDirty = qtyChanged || costChanged;

                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-1 md:grid-cols-12 md:items-center gap-2 px-3 py-3 border-b border-gray-50"
                  >
                    <div className="md:col-span-6">
                      <div className="text-sm font-extrabold text-gray-900 truncate">{p.slug}</div>
                      <div className="text-[11px] text-gray-500">Current: qty {formatNum(p.qty)} • cost {formatNum(p.cost)}</div>
                    </div>

                    <div className="md:col-span-2">
                      <div className="md:hidden text-[11px] font-extrabold text-gray-600 mb-1">Qty</div>
                      <input
                        value={qtyVal}
                        inputMode="decimal"
                        onChange={(ev) => setEdits((prev) => ({ ...prev, [p.id]: { ...prev[p.id], qty: ev.target.value } }))}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") saveOne(p);
                        }}
                        className={`h-11 md:h-10 w-full rounded-xl border px-3 md:px-2 text-left md:text-right text-sm outline-none focus:ring-2 focus:ring-[#0B6EA9]/20 ${
                          qtyBad ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-[#0B6EA9]"
                        }`}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <div className="md:hidden text-[11px] font-extrabold text-gray-600 mb-1">Cost</div>
                      <input
                        value={costVal}
                        inputMode="decimal"
                        onChange={(ev) => setEdits((prev) => ({ ...prev, [p.id]: { ...prev[p.id], cost: ev.target.value } }))}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") saveOne(p);
                        }}
                        className={`h-11 md:h-10 w-full rounded-xl border px-3 md:px-2 text-left md:text-right text-sm outline-none focus:ring-2 focus:ring-[#0B6EA9]/20 ${
                          costBad ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-[#0B6EA9]"
                        }`}
                      />
                    </div>

                    <div className="md:col-span-2 flex flex-col md:flex-row justify-stretch md:justify-end gap-2">
                      <button
                        type="button"
                        className="h-11 md:h-10 w-full md:w-auto rounded-xl border border-gray-200 bg-white px-3 text-sm font-extrabold text-gray-900 active:scale-[0.99] disabled:opacity-50"
                        disabled={isRowSaving || (!rowDirty && !e.qty && !e.cost) || qtyBad || costBad}
                        onClick={() => saveOne(p)}
                      >
                        {isRowSaving ? "Saving…" : "Save"}
                      </button>

                      <button
                        type="button"
                        className="h-11 md:h-10 w-full md:w-auto rounded-xl border border-gray-200 bg-white px-2 text-sm font-extrabold text-gray-500 active:scale-[0.99]"
                        onClick={() =>
                          setEdits((prev) => {
                            const cp = { ...prev };
                            delete cp[p.id];
                            return cp;
                          })
                        }
                        title="Reset edits"
                      >
                        ↺
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {err ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div> : null}

        <div className="text-xs text-gray-500">
          Tip: Use a barcode scanner that types into the search box (acts like keyboard). Type a slug, adjust qty, press Enter.
        </div>
      </div>
    </div>
  );
}