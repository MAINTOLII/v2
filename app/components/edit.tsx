

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Simple, self-contained admin carousel to review products one-by-one.
// - Left/Right navigation (buttons + keyboard)
// - Shows all key fields (slug, tags, price, qty, etc.)
// - If no image: upload an image to Storage bucket `product-images` under `products/` and update products.img

type ProductRow = {
  id: string;
  slug: string;
  qty: number | string | null;
  cost: number | string | null;
  price: number | string | null;
  tags: any;
  created_at?: string | null;
  updated_at?: string | null;
  is_weight?: boolean | null;
  subsubcategory_id?: number | null;
  is_online?: boolean | null;
  min_order_qty?: number | null;
  qty_step?: number | null;
  online_config?: any;
  img?: string | null;
};

function getSupabase(): SupabaseClient {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anon = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !anon) {
    // We throw so the UI can show a clear error.
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in env"
    );
  }
  return createClient(url, anon);
}

function slugify(input: string) {
  const s = String(input ?? "").trim();
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/(\d)\.(\d)/g, "$1$2")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeJson(v: any) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v ?? "");
  }
}

function toNum(v: any): number {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function encodeUrlMaybe(u: string) {
  try {
    return encodeURI(u);
  } catch {
    return u;
  }
}

function buildPublicImageUrl(input: any): string {
  const s = String(input ?? "").trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return encodeUrlMaybe(s);
  if (s.startsWith("/")) return s;

  const base = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  if (!base) return "";

  // If they stored a storage path like `product-images/products/...`
  if (s.startsWith("product-images/")) {
    return encodeUrlMaybe(`${base}/storage/v1/object/public/${s}`);
  }

  // If they stored `products/...` or similar
  if (
    s.startsWith("products/") ||
    s.startsWith("subcategories/") ||
    s.startsWith("categories/")
  ) {
    return encodeUrlMaybe(`${base}/storage/v1/object/public/product-images/${s}`);
  }

  return encodeUrlMaybe(`${base}/storage/v1/object/public/${s}`);
}

export default function EditProductsCarousel() {
  const supabaseRef = useRef<SupabaseClient | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [idx, setIdx] = useState(0);

  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploadOk, setUploadOk] = useState<string | null>(null);

  const current = products[idx] ?? null;

  const currentImgUrl = useMemo(() => {
    const u = buildPublicImageUrl(current?.img);
    return u || "";
  }, [current?.img]);

  // Init supabase (client-only)
  useEffect(() => {
    try {
      supabaseRef.current = getSupabase();
      setErr(null);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  }, []);

  const load = useCallback(async () => {
    const sb = supabaseRef.current;
    if (!sb) return;

    setLoading(true);
    setErr(null);
    try {
      const res = await sb
        .from("products")
        .select(
          "id,slug,qty,cost,price,tags,created_at,updated_at,is_weight,subsubcategory_id,is_online,min_order_qty,qty_step,online_config,img"
        )
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(2000);

      if (res.error) throw res.error;

      const rows = (res.data ?? []) as any as ProductRow[];
      setProducts(rows);
      setIdx((i) => {
        const next = Math.min(Math.max(0, i), Math.max(0, rows.length - 1));
        return next;
      });

      setLoading(false);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabaseRef.current) return;
    load();
  }, [load]);

  const goPrev = useCallback(() => {
    setIdx((i) => (i <= 0 ? 0 : i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIdx((i) => {
      const max = Math.max(0, products.length - 1);
      return i >= max ? max : i + 1;
    });
  }, [products.length]);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  const onUpload = useCallback(
    async (file: File) => {
      const sb = supabaseRef.current;
      if (!sb) return;
      if (!current) return;

      setUploading(true);
      setUploadErr(null);
      setUploadOk(null);

      try {
        const ext = (() => {
          const name = String(file.name ?? "");
          const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
          return m?.[1] || "webp";
        })();

        const safeSlug = slugify(current.slug || current.id);
        const path = `products/${safeSlug}.${ext}`;

        const up = await sb.storage
          .from("product-images")
          .upload(path, file, {
            upsert: true,
            contentType: file.type || undefined,
          });

        if (up.error) throw up.error;

        const pub = sb.storage.from("product-images").getPublicUrl(path);
        const publicUrl = pub?.data?.publicUrl ? encodeUrlMaybe(pub.data.publicUrl) : "";
        if (!publicUrl) throw new Error("Failed to build public URL for uploaded image");

        // Update products.img so the storefront can render it
        const upd = await sb
          .from("products")
          .update({ img: publicUrl })
          .eq("id", current.id)
          .select("id,img")
          .maybeSingle();

        if (upd.error) throw upd.error;

        // Update local state
        setProducts((prev) =>
          prev.map((p) => (p.id === current.id ? { ...p, img: publicUrl } : p))
        );

        setUploadOk("Image uploaded + saved to product");
        setUploading(false);
      } catch (e: any) {
        setUploadErr(String(e?.message ?? e));
        setUploading(false);
      }
    },
    [current]
  );

  if (loading) {
    return (
      <div className="w-full rounded-2xl border bg-white p-4 text-sm text-gray-700">
        Loading products…
      </div>
    );
  }

  if (err) {
    return (
      <div className="w-full rounded-2xl border bg-white p-4">
        <div className="text-sm font-extrabold text-gray-900">Error</div>
        <div className="mt-1 text-sm text-red-600 break-words">{err}</div>
        <button
          type="button"
          onClick={() => load()}
          className="mt-4 h-10 px-4 rounded-xl bg-[#0B6EA9] text-white font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="w-full rounded-2xl border bg-white p-4 text-sm text-gray-700">
        No products found.
      </div>
    );
  }

  const n = products.length;
  const isMissingImg = !String(current?.img ?? "").trim();

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-extrabold text-gray-900">
          Product {idx + 1} / {n}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={idx <= 0}
            className={`h-10 px-4 rounded-xl font-extrabold transition text-white ${
              idx <= 0 ? "bg-gray-300" : "bg-[#0B6EA9] hover:bg-[#095a88]"
            }`}
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={idx >= n - 1}
            className={`h-10 px-4 rounded-xl font-extrabold transition text-white ${
              idx >= n - 1 ? "bg-gray-300" : "bg-[#0B6EA9] hover:bg-[#095a88]"
            }`}
          >
            Next →
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border bg-white overflow-hidden">
        {/* Image */}
        <div className="relative w-full h-[340px] bg-white">
          {currentImgUrl ? (
            <Image
              src={currentImgUrl}
              alt={current.slug || "Product"}
              fill
              className="object-contain p-6"
              priority
            />
          ) : (
            <div className="h-full w-full grid place-items-center text-sm text-gray-500">
              No image
            </div>
          )}

          {/* Upload overlay if missing image */}
          {isMissingImg ? (
            <div className="absolute inset-x-0 bottom-0 p-4">
              <div className="rounded-2xl border bg-white/90 backdrop-blur p-3">
                <div className="text-sm font-extrabold text-gray-900">
                  Add an image for this product
                </div>
                <div className="mt-1 text-[12px] text-gray-600">
                  It will upload to <span className="font-bold">product-images/products/</span> and save the URL into
                  <span className="font-bold"> products.img</span>.
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <label className={`h-10 px-4 rounded-xl font-extrabold text-white cursor-pointer ${
                    uploading ? "bg-gray-300" : "bg-[#0B6EA9] hover:bg-[#095a88]"
                  }`}>
                    {uploading ? "Uploading…" : "Choose file"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        onUpload(f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => load()}
                    className="h-10 px-4 rounded-xl border font-extrabold"
                  >
                    Refresh
                  </button>
                </div>

                {uploadErr ? <div className="mt-2 text-[12px] text-red-600 break-words">{uploadErr}</div> : null}
                {uploadOk ? <div className="mt-2 text-[12px] text-green-700 font-bold">{uploadOk}</div> : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Details */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] text-gray-500 font-semibold">Slug</div>
              <div className="text-lg font-extrabold text-gray-900 break-words">
                {current.slug}
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-[12px] text-gray-500 font-semibold">Price</div>
              <div className="text-lg font-extrabold text-gray-900">${toNum(current.price).toFixed(2)}</div>
              <div className="text-[11px] text-gray-500 font-semibold">Cost: ${toNum(current.cost).toFixed(2)}</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-3">
              <div className="text-[12px] text-gray-500 font-semibold">Qty</div>
              <div className="text-base font-extrabold text-gray-900">{String(current.qty ?? "—")}</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-[12px] text-gray-500 font-semibold">Online</div>
              <div className="text-base font-extrabold text-gray-900">{current.is_online ? "Yes" : "No"}</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-[12px] text-gray-500 font-semibold">Weight item</div>
              <div className="text-base font-extrabold text-gray-900">{current.is_weight ? "Yes" : "No"}</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-[12px] text-gray-500 font-semibold">SubSubcategory</div>
              <div className="text-base font-extrabold text-gray-900">{String(current.subsubcategory_id ?? "—")}</div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[12px] text-gray-500 font-semibold">Tags</div>
            <div className="mt-1 rounded-xl border bg-gray-50 p-3 text-[12px] font-mono whitespace-pre-wrap break-words">
              {safeJson(current.tags)}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[12px] text-gray-500 font-semibold">Online config</div>
            <div className="mt-1 rounded-xl border bg-gray-50 p-3 text-[12px] font-mono whitespace-pre-wrap break-words">
              {safeJson(current.online_config)}
            </div>
          </div>

          <div className="mt-4 text-[11px] text-gray-500">
            Created: {String(current.created_at ?? "—")}<br />
            Updated: {String(current.updated_at ?? "—")}
          </div>

          {!isMissingImg ? (
            <div className="mt-4 rounded-xl border p-3">
              <div className="text-[12px] text-gray-500 font-semibold">Image URL</div>
              <div className="mt-1 text-[12px] font-semibold text-gray-900 break-all">{String(current.img ?? "")}</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 text-[12px] text-gray-500">
        Tip: use your keyboard <span className="font-bold">←</span> and <span className="font-bold">→</span> keys.
      </div>
    </div>
  );
}