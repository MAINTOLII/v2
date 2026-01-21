"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

// A lightweight, dependency-free “3D store” look using CSS perspective + tilt.
// Pulls products where subsubcategory_id = 10301.

type AnyProduct = Record<string, any>;

function formatMoney(n: any) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  // Keep it simple; avoid Intl locale mismatch issues.
  return `$${num.toFixed(2)}`;
}

function pickImage(p: AnyProduct): string | null {
  // Try common image fields; fall back to null.
  const candidates = [
    p.image_url,
    p.image,
    p.imageUrl,
    p.photo_url,
    p.photo,
    p.thumbnail,
  ];
  const v = candidates.find((x) => typeof x === "string" && x.trim().length > 0);
  return v ?? null;
}

function titleFromProduct(p: AnyProduct): string {
  return (
    p.name ??
    p.name_en ??
    p.title ??
    p.slug ??
    p.sku ??
    "Product"
  ).toString();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function Product3DCard({ p }: { p: AnyProduct }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const img = useMemo(() => pickImage(p), [p]);
  const title = useMemo(() => titleFromProduct(p), [p]);
  const price = useMemo(() => {
    const v = p.price ?? p.selling_price ?? p.sale_price ?? p.mrp;
    return formatMoney(v);
  }, [p]);

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = (e.clientX - cx) / (r.width / 2);
    const dy = (e.clientY - cy) / (r.height / 2);
    const rx = clamp(-dy * 10, -12, 12);
    const ry = clamp(dx * 12, -14, 14);
    el.style.setProperty("--rx", `${rx}deg`);
    el.style.setProperty("--ry", `${ry}deg`);
    el.style.setProperty("--mx", `${clamp(dx, -1, 1)}`);
    el.style.setProperty("--my", `${clamp(dy, -1, 1)}`);
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", `0deg`);
    el.style.setProperty("--ry", `0deg`);
    el.style.setProperty("--mx", `0`);
    el.style.setProperty("--my", `0`);
  }

  return (
    <div className="shelfSlot">
      <div
        ref={ref}
        className="box3d"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        role="button"
        tabIndex={0}
        aria-label={title}
      >
        <div className="boxFace front">
          <div className="boxTopBar">
            <div className="badge">REAL STORE</div>
            <div className="price">{price}</div>
          </div>

          <div className="media">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={title} loading="lazy" />
            ) : (
              <div className="noImg">
                <span>{title.slice(0, 1).toUpperCase()}</span>
              </div>
            )}
          </div>

          <div className="meta">
            <div className="title" title={title}>
              {title}
            </div>
            <div className="sub">
              {p.is_weight === true ? "Weighted" : "Unit"}
              {typeof p.qty === "number" ? ` • Stock: ${p.qty}` : ""}
            </div>
          </div>
        </div>

        {/* Faux depth sides */}
        <div className="boxFace right" />
        <div className="boxFace top" />
        <div className="boxShadow" />
      </div>
    </div>
  );
}

export default function Real() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<AnyProduct[]>([]);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("subsubcategory_id", 10301)
        .order("slug", { ascending: true })
        .limit(120);

      if (!alive) return;

      if (error) {
        setError(error.message ?? "Failed to load products");
        setProducts([]);
      } else {
        setProducts(Array.isArray(data) ? (data as AnyProduct[]) : []);
      }

      setLoading(false);
    }

    run();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="page">
      <header className="hero">
        <div className="heroInner">
          <div className="heroTitle">Real Store</div>
          <div className="heroSub">
            Browse items like you’re standing inside a shop aisle.
          </div>
        </div>
      </header>

      <main className="wrap">
        <div className="aisle">
          <div className="aisleBack" />

          <div className="toolbar">
            <div className="pill">Subsubcategory: 10301</div>
            <div className="pill">Items: {products.length}</div>
          </div>

          {loading ? (
            <div className="state">Loading products…</div>
          ) : error ? (
            <div className="state error">{error}</div>
          ) : products.length === 0 ? (
            <div className="state">No products found.</div>
          ) : (
            <div className="shelves" aria-label="Store shelves">
              {products.map((p) => (
                <Product3DCard key={p.id ?? p.slug ?? Math.random()} p={p} />
              ))}
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #0b0f14;
          color: #f3f6ff;
        }

        .hero {
          position: sticky;
          top: 0;
          z-index: 10;
          background: linear-gradient(180deg, rgba(17, 24, 39, 0.95), rgba(11, 15, 20, 0.85));
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .heroInner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 14px 16px;
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }
        .heroTitle {
          font-weight: 900;
          letter-spacing: 0.2px;
          font-size: 18px;
        }
        .heroSub {
          opacity: 0.8;
          font-size: 13px;
        }

        .wrap {
          max-width: 1100px;
          margin: 0 auto;
          padding: 16px;
        }

        .aisle {
          position: relative;
          border-radius: 18px;
          overflow: hidden;
          background: radial-gradient(1200px 600px at 50% 0%, rgba(120, 180, 255, 0.18), transparent 55%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .aisleBack {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(255, 255, 255, 0.04) 0, transparent 10%, transparent 90%, rgba(255, 255, 255, 0.04) 100%),
            repeating-linear-gradient(
              0deg,
              rgba(255, 255, 255, 0.05),
              rgba(255, 255, 255, 0.05) 2px,
              transparent 2px,
              transparent 64px
            );
          opacity: 0.55;
          pointer-events: none;
        }

        .toolbar {
          position: relative;
          z-index: 2;
          display: flex;
          gap: 10px;
          padding: 12px 12px 0 12px;
          flex-wrap: wrap;
        }
        .pill {
          font-size: 12px;
          padding: 8px 10px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
        }

        .state {
          position: relative;
          z-index: 2;
          padding: 22px 12px;
          color: rgba(243, 246, 255, 0.85);
        }
        .state.error {
          color: #ffb4b4;
        }

        /* Shelves grid */
        .shelves {
          position: relative;
          z-index: 2;
          padding: 14px 12px 18px 12px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        @media (min-width: 720px) {
          .shelves {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 18px;
          }
        }

        .shelfSlot {
          position: relative;
          padding-bottom: 12px;
        }
        /* shelf plank */
        .shelfSlot::after {
          content: "";
          position: absolute;
          left: 6px;
          right: 6px;
          bottom: 0;
          height: 10px;
          border-radius: 12px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.04));
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        /* 3D box */
        .box3d {
          --rx: 0deg;
          --ry: 0deg;
          --mx: 0;
          --my: 0;
          position: relative;
          height: 220px;
          border-radius: 16px;
          transform-style: preserve-3d;
          perspective: 900px;
          cursor: pointer;
          user-select: none;
          outline: none;
        }

        .box3d:focus-visible {
          box-shadow: 0 0 0 3px rgba(120, 180, 255, 0.35);
        }

        .boxFace {
          position: absolute;
          inset: 0;
          border-radius: 16px;
        }

        .front {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.04));
          border: 1px solid rgba(255, 255, 255, 0.10);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.38);
          transform: translateZ(18px) rotateX(var(--rx)) rotateY(var(--ry));
          transition: transform 160ms ease, box-shadow 160ms ease;
          overflow: hidden;
        }

        .box3d:hover .front {
          box-shadow: 0 35px 80px rgba(0, 0, 0, 0.45);
        }

        .right {
          width: 26px;
          left: auto;
          right: -2px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(0, 0, 0, 0.22));
          border: 1px solid rgba(255, 255, 255, 0.08);
          transform: translateZ(4px) rotateY(90deg);
          transform-origin: right center;
          filter: saturate(0.9);
          opacity: 0.9;
        }

        .top {
          height: 24px;
          bottom: auto;
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04));
          border: 1px solid rgba(255, 255, 255, 0.08);
          transform: translateZ(4px) rotateX(90deg);
          transform-origin: top center;
          opacity: 0.9;
        }

        .boxShadow {
          position: absolute;
          inset: 10px;
          border-radius: 18px;
          background: radial-gradient(180px 120px at calc(50% + (var(--mx) * 18px)) calc(65% + (var(--my) * 12px)), rgba(0, 0, 0, 0.55), transparent 70%);
          transform: translateZ(0px);
          pointer-events: none;
          filter: blur(6px);
          opacity: 0.9;
        }

        .boxTopBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 10px 0 10px;
        }

        .badge {
          font-size: 10px;
          letter-spacing: 0.8px;
          padding: 6px 8px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.10);
        }

        .price {
          font-weight: 900;
          font-size: 12px;
          opacity: 0.95;
        }

        .media {
          margin: 10px;
          height: 120px;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.22);
          border: 1px solid rgba(255, 255, 255, 0.08);
          overflow: hidden;
          display: grid;
          place-items: center;
        }

        .media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scale(1.02);
        }

        .noImg {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          background: radial-gradient(220px 140px at 50% 30%, rgba(120, 180, 255, 0.20), transparent 55%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(0, 0, 0, 0.20));
        }
        .noImg span {
          font-size: 46px;
          font-weight: 900;
          opacity: 0.9;
        }

        .meta {
          padding: 0 10px 12px 10px;
        }

        .title {
          font-weight: 800;
          font-size: 13px;
          line-height: 1.2;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .sub {
          margin-top: 6px;
          font-size: 11px;
          opacity: 0.75;
        }
      `}</style>
    </div>
  );
}
