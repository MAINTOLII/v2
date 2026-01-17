// app/components/Online.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Online.tsx
 *
 * ✅ Uses ONLY products.online_config (jsonb) for:
 * - min / step (can be < 1)
 * - exact options (e.g. 250g, 500g, 5 pcs)
 * - bulk tiers (e.g. 1–2, 3+)
 *
 * ❌ Does NOT use product_price_tiers table.
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
  unit: string; // "kg" | "pcs" | anything
  is_weight: boolean;
  min: number;
  step: number;
  options: OnlineOption[];
};

type Product = {
  id: string;
  slug: string;
  qty: number;
  price: number;
  cost: number;
  tags: string[];
  is_weight: boolean;
  is_online: boolean;
  min_order_qty?: number | null;
  qty_step?: number | null;
  online_config?: any;
};

type CartItem = {
  slug: string;
  is_weight: boolean;
  qty: number;
  unit_price: number;
};

type OrderChannel = "website" | "whatsapp" | "pos";

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: 16,
    background: "#fafafa",
    minHeight: "100vh",
    color: "#111",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },
  container: { maxWidth: 1200, margin: "0 auto", display: "grid", gap: 14 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
    flexWrap: "wrap",
  },
  titleWrap: { display: "grid", gap: 4 },
  title: { margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" },
  subtitle: { margin: 0, fontSize: 13, opacity: 0.75 },

  shell: { display: "grid", gridTemplateColumns: "1fr 360px", gap: 12, alignItems: "start" },

  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 },
  cardTitleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  cardTitle: { margin: 0, fontSize: 16, fontWeight: 900 },
  divider: { height: 1, background: "#f1f5f9", border: 0, margin: "10px 0" },

  search: { height: 38, minWidth: 240, padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", fontSize: 14 },

  grid: { display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" },
  productCard: { border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff", display: "grid", gap: 10 },
  slug: { margin: 0, fontSize: 15, fontWeight: 900, wordBreak: "break-word" },
  meta: { fontSize: 12, opacity: 0.85, lineHeight: 1.35 },
  badgeRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  badge: { display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 999, border: "1px solid #e5e7eb", fontSize: 12, fontWeight: 900, background: "#fff", whiteSpace: "nowrap" },

  priceBig: { fontSize: 20, fontWeight: 1000, letterSpacing: "-0.02em" },
  priceSmall: { fontSize: 12, opacity: 0.75 },

  optionWrap: { display: "flex", gap: 8, flexWrap: "wrap" },
  optBtn: { height: 36, padding: "0 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" },
  optBtnActive: { border: "1px solid #111", background: "#111", color: "#fff" },

  qtyRow: { display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" },
  input: { height: 38, width: 140, padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", outline: "none", fontSize: 14, background: "#fff" },

  btn: { height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" },
  btnGhost: { height: 34, padding: "0 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", color: "#111", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" },
  btnDanger: { height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #f1c4c4", background: "#fff", color: "#b42318", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" },

  cartList: { display: "grid", gap: 10 },
  cartItem: { border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, display: "grid", gap: 8 },
  cartTop: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" },
  cartSlug: { margin: 0, fontWeight: 900, fontSize: 14 },
  cartMeta: { fontSize: 12, opacity: 0.85 },

  totalRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  total: { fontSize: 18, fontWeight: 950, letterSpacing: "-0.02em" },

  err: { color: "#b42318", fontWeight: 800, fontSize: 13 },
  hint: { fontSize: 12, opacity: 0.75 },
};

function money(n: number) {
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}
function parseNum(v: unknown): number {
  const s = String(v ?? "").trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
function roundToStep(value: number, step: number) {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(step) || step <= 0) return value;
  const inv = 1 / step;
  return Math.round(value * inv) / inv;
}
function clampMin(value: number, min: number) {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value;
}
function normalizeQty(value: number, min: number, step: number, isWeight: boolean) {
  const v = clampMin(value, min);
  const safeStep = Number.isFinite(step) && step > 0 ? step : isWeight ? 0.5 : 1;
  const r = isWeight ? roundToStep(v, safeStep) : Math.round(v / safeStep) * safeStep;
  return Math.max(min, Number(r.toFixed(isWeight ? 2 : 0)));
}
function makeId() {
  return `opt_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function defaultRulesFor(p: Product) {
  if (p.is_weight) return { unit: "kg", min: Number(p.min_order_qty ?? 0.5) || 0.5, step: Number(p.qty_step ?? 0.5) || 0.5 };
  return { unit: "pcs", min: Number(p.min_order_qty ?? 1) || 1, step: Number(p.qty_step ?? 1) || 1 };
}

function normalizeOption(o: any): OnlineOption | null {
  const type: any = o?.type;
  if (type !== "exact" && type !== "bulk") return null;

  const label = String(o?.label ?? "").trim();
  if (!label) return null;

  const unit_price = parseNum(o?.unit_price);
  if (!Number.isFinite(unit_price) || unit_price < 0) return null;

  if (type === "exact") {
    const qty = parseNum(o?.qty);
    if (!Number.isFinite(qty) || qty <= 0) return null;
    return { id: String(o?.id || makeId()), type: "exact", label, qty, min_qty: null, max_qty: null, unit_price };
  }

  const min_qty = parseNum(o?.min_qty);
  const max_qty = o?.max_qty == null || String(o?.max_qty).trim() === "" ? null : parseNum(o?.max_qty);

  if (!Number.isFinite(min_qty) || min_qty < 0) return null;
  if (max_qty != null && (!Number.isFinite(max_qty) || max_qty < min_qty)) return null;

  return { id: String(o?.id || makeId()), type: "bulk", label, qty: null, min_qty, max_qty: max_qty ?? null, unit_price };
}

function dedupeOptions(options: OnlineOption[]) {
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

function normalizeConfig(raw: any, p: Product): OnlineConfig {
  const base = defaultRulesFor(p);

  const unit = String(raw?.unit || base.unit);
  const is_weight = !!(raw?.is_weight ?? p.is_weight);

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

function pickUnitPrice(cfg: OnlineConfig, basePrice: number, qty: number): { unit_price: number; matchedId?: string } {
  const q2 = Number(qty.toFixed(3));

  const exact = cfg.options.find((o) => o.type === "exact" && Number((o.qty ?? 0).toFixed(3)) === q2);
  if (exact) return { unit_price: Number(exact.unit_price) || 0, matchedId: exact.id };

  const bulk = cfg.options
    .filter((o) => o.type === "bulk" && Number(o.min_qty ?? 0) <= qty && (o.max_qty == null || qty <= Number(o.max_qty)))
    .sort((a, b) => Number(b.min_qty ?? 0) - Number(a.min_qty ?? 0))[0];

  if (bulk) return { unit_price: Number(bulk.unit_price) || 0, matchedId: bulk.id };

  return { unit_price: Number(basePrice) || 0 };
}


function fmtQty(qty: number, unit: string, isWeight: boolean) {
  if (!isWeight) return `${Math.round(qty)} ${unit}`;
  if (qty > 0 && qty < 1) return `${Math.round(qty * 1000)} g`;
  return `${Number(qty.toFixed(2))} ${unit}`;
}

function cleanPhone(p: string) {
  return p.replace(/[^\d+]/g, "").trim();
}

export default function Online() {
  const [products, setProducts] = useState<Product[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");

  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});

  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<OrderChannel>("website");
  const [placing, setPlacing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string>("");

  const productsBySlug = useMemo(() => {
    const map: Record<string, Product> = {};
    for (const p of products) map[p.slug] = p;
    return map;
  }, [products]);

  async function load() {
    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase
      .from("products")
      .select("id,slug,qty,price,cost,tags,is_weight,is_online,min_order_qty,qty_step,online_config")
      .eq("is_online", true)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
      setProducts([]);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as Product[];
    const onlineOnly = list.filter((p) => p.is_online);
    setProducts(onlineOnly);


    setQtyDraft((prev) => {
      const next = { ...prev };
      for (const p of onlineOnly) {
        if (next[p.slug] === undefined) {
          const cfg = normalizeConfig(p.online_config, p);
          next[p.slug] = String(cfg.min);
        }
      }
      return next;
    });

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.slug.toLowerCase().includes(q));
  }, [products, search]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const total = useMemo(() => cartItems.reduce((sum, it) => sum + it.unit_price * it.qty, 0), [cartItems]);

  function cartQty(slug: string): number {
    return cart[slug]?.qty ?? 0;
  }

  function maxAllowedForSlug(slug: string): number {
    return Math.max(0, Number(productsBySlug[slug]?.qty ?? 0));
  }

  function availableQty(slug: string): number {
    const stock = maxAllowedForSlug(slug);
    const inCart = Number(cartQty(slug) ?? 0);
    return Math.max(0, stock - inCart);
  }

  function addToCart(p: Product) {
    setSuccessMsg("");
    setErrorMsg("");

    const cfg = normalizeConfig(p.online_config, p);
    const raw = qtyDraft[p.slug] ?? String(cfg.min);
    const desired = normalizeQty(parseNum(raw), cfg.min, cfg.step, cfg.is_weight);

    const avail = availableQty(p.slug);
    if (avail <= 0) {
      setErrorMsg(`Out of stock: ${p.slug}`);
      return;
    }

    if (desired > avail) {
      setErrorMsg(`Not enough stock for ${p.slug}. Available: ${avail}`);
      return;
    }

    setCart((prev) => {
      const existing = prev[p.slug];
      const nextQty = existing ? normalizeQty(existing.qty + desired, cfg.min, cfg.step, cfg.is_weight) : desired;

      const max = maxAllowedForSlug(p.slug);
      if (nextQty > max) {
        setErrorMsg(`Not enough stock for ${p.slug}. Max: ${max}`);
        return prev;
      }

      const picked = pickUnitPrice(cfg, Number(p.price), nextQty);

      return {
        ...prev,
        [p.slug]: {
          slug: p.slug,
          is_weight: !!cfg.is_weight,
          qty: nextQty,
          unit_price: picked.unit_price,
        },
      };
    });
  }

  function setCartQty(slug: string, qty: number) {
    setSuccessMsg("");
    setErrorMsg("");

    const p = productsBySlug[slug];
    if (!p) return;

    const cfg = normalizeConfig(p.online_config, p);
    const safe = normalizeQty(qty, cfg.min, cfg.step, cfg.is_weight);

    const max = maxAllowedForSlug(slug);
    if (safe > max) {
      setErrorMsg(`Cannot exceed stock for ${slug}. Max: ${max}`);
      return;
    }

    const picked = pickUnitPrice(cfg, Number(p.price), safe);

    setCart((prev) => {
      if (!prev[slug]) return prev;
      return { ...prev, [slug]: { ...prev[slug], qty: safe, unit_price: picked.unit_price } };
    });
  }

  function setCartUnitPrice(slug: string, unitPrice: number) {
    setSuccessMsg("");
    setErrorMsg("");

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setErrorMsg("Enter a valid unit price (0 or more).");
      return;
    }

    setCart((prev) => {
      if (!prev[slug]) return prev;
      return { ...prev, [slug]: { ...prev[slug], unit_price: Number(unitPrice) } };
    });
  }

  function removeFromCart(slug: string) {
    setCart((prev) => {
      const next = { ...prev };
      delete next[slug];
      return next;
    });
  }


  function clearCart() {
    setCart({});
  }

  async function checkout() {
    setSuccessMsg("");
    setErrorMsg("");

    const p = cleanPhone(phone);
    if (!p || p.length < 7) {
      setErrorMsg("Enter a valid phone number (digits only).");
      return;
    }
    if (cartItems.length === 0) {
      setErrorMsg("Cart is empty.");
      return;
    }

    for (const it of cartItems) {
      const stock = Number(productsBySlug[it.slug]?.qty ?? 0);
      if (it.qty > stock) {
        setErrorMsg(`Not enough stock for ${it.slug}. In cart: ${it.qty}, Stock: ${stock}`);
        return;
      }
    }

    setPlacing(true);

    const { data: orderRow, error: orderErr } = await supabase
      .from("orders")
      .insert({ phone: p, status: "pending", channel, total: 0 })
      .select("id")
      .single();

    if (orderErr || !orderRow?.id) {
      setErrorMsg(orderErr?.message ?? "Failed to create order");
      setPlacing(false);
      return;
    }

    const orderId = orderRow.id as string;

    const itemsPayload = cartItems.map((it) => ({
      order_id: orderId,
      product_slug: it.slug,
      qty: it.qty,
      unit_price: it.unit_price,
      unit_cost: Number(productsBySlug[it.slug]?.cost ?? 0),
      line_total: Number((it.unit_price * it.qty).toFixed(2)),
      is_weight: it.is_weight,
    }));

    const { error: itemsErr } = await supabase.from("order_items").insert(itemsPayload);
    if (itemsErr) {
      setErrorMsg(itemsErr.message);
      setPlacing(false);
      return;
    }

    await supabase.rpc("recalc_order_total", { p_order_id: orderId });
    await supabase.rpc("recalc_order_profit", { p_order_id: orderId });

    clearCart();
    setPhone("");
    setSuccessMsg(`Order placed! Status: pending (waiting confirmation).`);
    setPlacing(false);
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <div style={s.titleWrap}>
            <h1 style={s.title}>Online (Test Storefront)</h1>
            <p style={s.subtitle}>Pick option → Add → Checkout with phone</p>
          </div>
          <div style={s.badgeRow}>
            <span style={s.badge}>Items: {products.length}</span>
            <span style={s.badge}>Cart: {cartItems.length}</span>
          </div>
        </header>

        {errorMsg ? (
          <div style={{ ...s.card, border: "1px solid #f1c4c4" }}>
            <div style={s.err}>{errorMsg}</div>
          </div>
        ) : null}

        {successMsg ? (
          <div style={{ ...s.card, border: "1px solid #c7f0d1" }}>
            <div style={{ fontWeight: 900 }}>{successMsg}</div>
          </div>
        ) : null}

        <div className="online-shell" style={s.shell}>
          <section style={s.card}>
            <div style={s.cardTitleRow}>
              <h2 style={s.cardTitle}>Products</h2>
              <input style={s.search} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <hr style={s.divider} />

            {loading ? (
              <div style={{ opacity: 0.75 }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No products found.</div>
            ) : (
              <div style={s.grid}>
                {filtered.map((p) => {
                  const cfg = normalizeConfig(p.online_config, p);

                  const rawDraft = parseNum(qtyDraft[p.slug] ?? String(cfg.min));
                  const draftQty = normalizeQty(Number.isFinite(rawDraft) ? rawDraft : cfg.min, cfg.min, cfg.step, cfg.is_weight);

                  const picked = pickUnitPrice(cfg, Number(p.price), draftQty);
                  const unit = picked.unit_price;
                  const line = unit * draftQty;

                  const activeId = picked.matchedId;

                  const exactOptions = cfg.options.filter((o) => o.type === "exact");
                  const bulkOptions = cfg.options.filter((o) => o.type === "bulk");

                  return (
                    <div key={p.id} style={s.productCard}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <p style={s.slug}>{p.slug}</p>

                        <div style={s.meta}>
                          <div style={s.badgeRow}>
                            <span style={s.badge}>{cfg.is_weight ? "Weight" : "Unit"}</span>
                            <span style={s.badge}>Stock: {p.qty}</span>
                            <span style={s.badge}>Available: {availableQty(p.slug)}</span>
                          </div>

                          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                            <div style={s.priceBig}>{money(unit)}</div>
                            <div style={s.priceSmall}>
                              per {cfg.unit} • You selected <b>{fmtQty(draftQty, cfg.unit, cfg.is_weight)}</b>
                            </div>
                            <div style={s.priceSmall}>
                              Total for this: <b>{money(line)}</b>
                            </div>
                          </div>
                        </div>
                      </div>

                      {(exactOptions.length > 0 || bulkOptions.length > 0) ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          {exactOptions.length > 0 ? (
                            <div style={s.optionWrap}>
                              {exactOptions.map((o) => {
                                const isActive = !!activeId && activeId === o.id;
                                return (
                                  <button
                                    key={o.id}
                                    type="button"
                                    style={{ ...s.optBtn, ...(isActive ? s.optBtnActive : {}) }}
                                    onClick={() => setQtyDraft((prev) => ({ ...prev, [p.slug]: String(o.qty ?? cfg.min) }))}
                                  >
                                    {o.label}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}

                          {bulkOptions.length > 0 ? (
                            <div style={s.optionWrap}>
                              {bulkOptions.map((o) => {
                                const isActive = !!activeId && activeId === o.id;
                                return (
                                  <button
                                    key={o.id}
                                    type="button"
                                    style={{ ...s.optBtn, ...(isActive ? s.optBtnActive : {}) }}
                                    onClick={() => setQtyDraft((prev) => ({ ...prev, [p.slug]: String(o.min_qty ?? cfg.min) }))}
                                  >
                                    {o.label}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div style={s.hint}>No options configured yet. Use Custom page to set options.</div>
                      )}

                      <div style={s.qtyRow}>
                        <input
                          style={s.input}
                          type="number"
                          step={String(cfg.step)}
                          min={cfg.min}
                          value={qtyDraft[p.slug] ?? String(cfg.min)}
                          onChange={(e) => setQtyDraft((prev) => ({ ...prev, [p.slug]: e.target.value }))}
                        />
                        <button style={s.btn} onClick={() => addToCart(p)}>
                          Add
                        </button>
                      </div>

                      <div style={s.hint}>
                        Min {cfg.min}
                        {cfg.unit} • Step {cfg.step}
                        {cfg.unit}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside style={{ ...s.card, position: "sticky", top: 12 }}>
            <div style={s.cardTitleRow}>
              <h2 style={s.cardTitle}>Cart</h2>
              <button style={s.btnGhost} type="button" onClick={clearCart} disabled={cartItems.length === 0}>
                Clear
              </button>
            </div>
            <hr style={s.divider} />

            {cartItems.length === 0 ? (
              <div style={{ opacity: 0.75 }}>Cart is empty.</div>
            ) : (
              <div style={s.cartList}>
                {cartItems.map((item) => {
                  const p = productsBySlug[item.slug];
                  const cfg = p
                    ? normalizeConfig(p.online_config, p)
                    : { unit: item.is_weight ? "kg" : "pcs", is_weight: item.is_weight, min: 1, step: 1, options: [] };
                  const line = item.unit_price * item.qty;

                  return (
                    <div key={item.slug} style={s.cartItem}>
                      <div style={s.cartTop}>
                        <div style={{ display: "grid", gap: 4 }}>
                          <p style={s.cartSlug}>{item.slug}</p>
                          <div style={s.cartMeta}>
                            <span style={s.badge}>{cfg.is_weight ? "kg" : "pcs"}</span>
                            <span style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              Unit:
                              <input
                                style={{ ...s.input, height: 34, width: 120 }}
                                type="number"
                                step="0.01"
                                min={0}
                                value={String(item.unit_price)}
                                onChange={(e) => setCartUnitPrice(item.slug, parseNum(e.target.value))}
                              />
                              <span>/ {cfg.unit}</span>
                            </span>
                          </div>
                        </div>
                        <button style={s.btnDanger} type="button" onClick={() => removeFromCart(item.slug)}>
                          Remove
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                        <input
                          style={s.input}
                          type="number"
                          step={String(cfg.step)}
                          min={cfg.min}
                          value={String(item.qty)}
                          onChange={(e) => setCartQty(item.slug, Number(e.target.value))}
                        />
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12, opacity: 0.8 }}>Line total</div>
                          <div style={{ fontWeight: 950, fontSize: 16 }}>{money(line)}</div>
                        </div>
                      </div>

                      <div style={s.hint}>
                        Qty: <b>{fmtQty(item.qty, cfg.unit, cfg.is_weight)}</b>
                      </div>
                    </div>
                  );
                })}

                <div style={{ ...s.cartItem, borderStyle: "dashed" }}>
                  <div style={s.totalRow}>
                    <div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>Total</div>
                      <div style={s.total}>{money(total)}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>Phone</div>
                      <input style={{ ...s.input, width: "100%" }} placeholder="e.g. 0612345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>

                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>Order type</div>
                      <select style={{ ...s.input, width: "100%" }} value={channel} onChange={(e) => setChannel(e.target.value as OrderChannel)}>
                        <option value="website">website</option>
                        <option value="whatsapp">whatsapp</option>
                        <option value="pos">POS</option>
                      </select>
                    </div>

                    <button style={s.btn} type="button" onClick={checkout} disabled={placing}>
                      {placing ? "Placing…" : "Checkout (pending)"}
                    </button>

                    <div style={s.hint}>
                      Checkout creates a <b>pending</b> order. Inventory reduces only when you confirm it in Orders page.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>

        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media (max-width: 980px) {
                .online-shell { grid-template-columns: 1fr !important; }
              }
            `,
          }}
        />
      </div>
    </main>
  );
}