"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Upload.tsx
 *
 * Mobile-first Product Editor for:
 * - Edit product tags
 * - Upload product image (WEBP) to Supabase Storage bucket `product-images`
 *   at: products/{slug}.webp
 * - Save the public image URL into `products.img`
 *
 * Required public URL format:
 * https://swrgqktuatubssvwjkyx.supabase.co/storage/v1/object/public/product-images/products/{productname}.webp
 */

type ProductRow = {
  id: string;
  slug: string;
  tags: string[] | null;
  img: string | null;
};

const STORAGE_BASE_URL =
  "https://swrgqktuatubssvwjkyx.supabase.co/storage/v1/object/public/product-images";
const BUCKET = "product-images";

function normalizeSpaces(v: string) {
  return (v ?? "").trim().replace(/\s+/g, " ");
}

// Create a filename from the product slug that keeps spaces + dots.
// Example: "saafi water 1.5l" -> "saafi water 1.5.webp"
function productNameToWebpFileName(slug: string) {
  const base = normalizeSpaces(slug)
    .toLowerCase()
    // remove characters that break paths, keep letters/numbers/space/dot
    .replace(/[^a-z0-9 .]/g, "")
    .trim();

  // If the name ends with something like " 1.5l" and you want " 1.5" (remove trailing single-letter unit),
  // strip a trailing single letter when it follows a number.
  const withoutUnit = base.replace(/(\d)\s*[a-z]$/i, "$1");

  const finalBase = withoutUnit.trim();
  return `${finalBase}.webp`;
}

function parseTagsInput(v: string): string[] {
  return (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 100);
}

export default function Upload() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [tagsText, setTagsText] = useState("");
  const [busySave, setBusySave] = useState(false);

  const [imgUploading, setImgUploading] = useState(false);
  const [imgFileName, setImgFileName] = useState<string>("");

  const [ok, setOk] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const searchDebounceRef = useRef<any>(null);

  const tagsPreview = useMemo(() => parseTagsInput(tagsText), [tagsText]);

  useEffect(() => {
    // Debounced search
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      const q = query.trim();
      setOk("");
      setErr("");

      if (!q) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("products")
          .select("id,slug,tags,img")
          .ilike("slug", `%${q}%`)
          .order("slug", { ascending: true })
          .limit(30);

        if (error) throw error;
        setResults((data as ProductRow[]) ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Search failed");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [query]);

  function onSelect(p: ProductRow) {
    setSelected(p);
    setTagsText((p.tags ?? []).join(", "));
    setImgFileName(p.img ? p.img.split("/").pop() || "" : "");
    setOk("");
    setErr("");
  }

  async function saveTagsOnly() {
    setOk("");
    setErr("");

    if (!selected) {
      setErr("Select a product first.");
      return;
    }

    setBusySave(true);
    try {
      const tags = parseTagsInput(tagsText);
      const { error } = await supabase
        .from("products")
        .update({ tags })
        .eq("id", selected.id);
      if (error) throw error;

      const updated: ProductRow = { ...selected, tags };
      setSelected(updated);
      setResults((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setOk("Saved tags ✅");
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setBusySave(false);
    }
  }

  async function uploadImage(file: File) {
    setOk("");
    setErr("");

    if (!selected) {
      setErr("Select a product first.");
      return;
    }

    // Require WEBP (because you want .webp in the URL)
    const isWebp = file.type === "image/webp" || file.name.toLowerCase().endsWith(".webp");
    if (!isWebp) {
      setErr("Please upload a WEBP image (.webp). Convert it first, then upload.");
      return;
    }

    const fileName = productNameToWebpFileName(selected.slug);
    if (!fileName || fileName === ".webp") {
      setErr("Invalid product name.");
      return;
    }

    const path = `products/${fileName}`;
    // encode spaces etc. for browser URL, but keep the slash
    const publicUrl = `${STORAGE_BASE_URL}/${encodeURI(path)}`;

    setImgUploading(true);
    try {
      // Upload to bucket with fixed path
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          upsert: true,
          contentType: "image/webp",
          cacheControl: "3600",
        });
      if (upErr) throw upErr;

      // Save to products.img
      const { error: dbErr } = await supabase
        .from("products")
        .update({ img: publicUrl })
        .eq("id", selected.id);
      if (dbErr) throw dbErr;

      const updated: ProductRow = { ...selected, img: publicUrl };
      setSelected(updated);
      setResults((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setImgFileName(fileName);
      setOk("Image uploaded + saved ✅");
    } catch (e: any) {
      setErr(e?.message ?? "Image upload failed");
    } finally {
      setImgUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fafafa] px-4 py-4 text-gray-900">
      <div className="mx-auto w-full max-w-xl">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-extrabold">Product Editor</h1>
            <p className="text-xs text-gray-500">
              Search a product by slug, then update <b>tags</b> and upload a <b>WEBP image</b>.
            </p>
          </div>

          <div className="mt-3">
            <label className="text-[11px] font-extrabold text-gray-700">Search by slug</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g. "omo" or "yaanyo"'
              className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#0B6EA9] focus:ring-2 focus:ring-[#0B6EA9]/20"
            />
            <div className="mt-2 text-[11px] text-gray-500">
              {loading ? "Searching…" : query.trim() ? `${results.length} results` : "Type to search"}
            </div>

            {results.length > 0 ? (
              <div className="mt-2 max-h-[40vh] overflow-auto rounded-xl border border-gray-100">
                {results.map((p) => {
                  const active = selected?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelect(p)}
                      className={`w-full text-left px-3 py-3 border-b border-gray-50 active:scale-[0.99] ${
                        active ? "bg-[#0B6EA9]/10" : "bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold">{p.slug}</div>
                          <div className="mt-1 text-[11px] text-gray-500">
                            tags: {(p.tags ?? []).length} • img: {p.img ? "yes" : "no"}
                          </div>
                        </div>
                        <div className="shrink-0 text-[11px] font-extrabold text-gray-500">Edit</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-3">
            {!selected ? (
              <div className="text-sm text-gray-600">Pick a product above to start editing.</div>
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-[11px] font-extrabold text-gray-700">Selected product</div>
                  <div className="mt-1 flex flex-col gap-1">
                    <div className="text-base font-extrabold break-words">{selected.slug}</div>
                    <div className="text-[11px] text-gray-500 break-words">
                      Image URL: {selected.img ? selected.img : "(none)"}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-extrabold text-gray-700">Tags (comma separated)</label>
                  <textarea
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    rows={3}
                    placeholder="e.g. saabuun, nadiifin, omo"
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0B6EA9] focus:ring-2 focus:ring-[#0B6EA9]/20"
                  />

                  {tagsPreview.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {tagsPreview.slice(0, 18).map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-extrabold text-gray-700"
                        >
                          {t}
                        </span>
                      ))}
                      {tagsPreview.length > 18 ? (
                        <span className="text-[11px] font-extrabold text-gray-500">
                          +{tagsPreview.length - 18} more
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-gray-500">No tags yet.</div>
                  )}

                  <button
                    type="button"
                    onClick={saveTagsOnly}
                    disabled={busySave}
                    className="mt-3 h-11 w-full rounded-xl bg-[#0B6EA9] px-3 text-sm font-extrabold text-white shadow-sm active:scale-[0.99] disabled:opacity-50"
                  >
                    {busySave ? "Saving…" : "Save Tags"}
                  </button>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="text-[11px] font-extrabold text-gray-700">Product Image (WEBP)</div>
                  <div className="mt-1 text-[11px] text-gray-500 break-words">
                    Will upload to: <span className="font-mono">products/{productNameToWebpFileName(selected.slug)}</span>
                  </div>

                  <div className="mt-2 flex flex-col gap-2">
                    <input
                      type="file"
                      accept="image/webp"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(f);
                        // reset so re-uploading same file works
                        e.currentTarget.value = "";
                      }}
                      className="block w-full text-sm"
                      disabled={imgUploading}
                    />

                    {selected.img ? (
                      <div className="mt-2 overflow-hidden rounded-xl border border-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={selected.img} alt={selected.slug} className="h-auto w-full" />
                      </div>
                    ) : null}

                    {imgUploading ? (
                      <div className="text-sm font-extrabold text-gray-700">Uploading…</div>
                    ) : imgFileName ? (
                      <div className="text-[11px] text-gray-500">File: {imgFileName}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>

          {err ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-extrabold text-red-700">
              {err}
            </div>
          ) : null}
          {ok ? (
            <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-extrabold text-green-700">
              {ok}
            </div>
          ) : null}

          <div className="mt-4 text-[11px] text-gray-500">
            Tip: If you need to convert images to WEBP, use any online converter and upload the .webp file.
          </div>
        </div>
      </div>
    </main>
  );
}