"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Product = {
  id: string;
  slug: string;
  qty: number;
  price: number;
  cost: number;
  mrp: number;
  tags: string[];
  is_weight: boolean;
};

type CartItem = {
  slug: string;
  price: number;
  is_weight: boolean;
  qty: number; // kg if is_weight, else units
};

type OrderChannel = "website" | "whatsapp" | "pos";

const s: Record<string, React.CSSProperties> = {
  page: { padding: 16, background: "#fafafa", minHeight: "100vh", color: "#111", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" },
  container: { maxWidth: 1200, margin: "0 auto", display: "grid", gap: 14 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" },
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
  meta: { fontSize: 12, opacity: 0.8, lineHeight: 1.35 },
  badgeRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  badge: { display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 999, border: "1px solid #e5e7eb", fontSize: 12, fontWeight: 900, background: "#fff", whiteSpace: "nowrap" },
  tags: { display: "flex", gap: 6, flexWrap: "wrap" },
  tag: { display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 999, background: "#f3f4f6", border: "1px solid #e5e7eb", fontSize: 12, fontWeight: 800 },

  qtyRow: { display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" },
  input: { height: 38, width: 140, padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", outline: "none", fontSize: 14, background: "#fff" },

  btn: { height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" },
  btnGhost: { height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", color: "#111", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" },
  btnDanger: { height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #f1c4c4", background: "#fff", color: "#b42318", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" },

  cartList: { display: "grid", gap: 10 },
  cartItem: { border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, display: "grid", gap: 8 },
  cartTop: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" },
  cartSlug: { margin: 0, fontWeight: 900, fontSize: 14 },
  cartMeta: { fontSize: 12, opacity: 0.8 },

  totalRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  total: { fontSize: 18, fontWeight: 950, letterSpacing: "-0.02em" },

  err: { color: "#b42318", fontWeight: 800, fontSize: 13 },
  hint: { fontSize: 12, opacity: 0.75 },
};

function money(n: number) {
  return `$${n.toFixed(2)}`;
}
function clampMin(value: number, min: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, value);
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

  async function load() {
    setLoading(true);
    setErrorMsg("");
    const { data, error } = await supabase.from("products").select("id,slug,qty,price,cost,mrp,tags,is_weight").order("created_at", { ascending: false });
    if (error) {
      setErrorMsg(error.message);
      setProducts([]);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as Product[];
    setProducts(list);

    setQtyDraft((prev) => {
      const next = { ...prev };
      for (const p of list) if (next[p.slug] === undefined) next[p.slug] = "1";
      return next;
    });

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.slug.toLowerCase().includes(q) || (p.tags ?? []).some((t) => t.toLowerCase().includes(q)));
  }, [products, search]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const total = useMemo(() => cartItems.reduce((sum, item) => sum + item.price * item.qty, 0), [cartItems]);
const productsBySlug = useMemo(() => {
  const map: Record<string, Product> = {};
  for (const p of products) map[p.slug] = p;
  return map;
}, [products]);

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

  const raw = qtyDraft[p.slug] ?? "1";
  const min = p.is_weight ? 0.01 : 1;
  const desired = clampMin(Number(raw), min);

  const avail = availableQty(p.slug);

  // Reject if no stock
  if (avail <= 0) {
    setErrorMsg(`Out of stock: ${p.slug}`);
    return;
  }

  // Reject if requested > stock (STRICT reject, not partial add)
  if (desired > avail) {
    setErrorMsg(`Not enough stock for ${p.slug}. Available: ${avail}`);
    return;
  }

  setCart((prev) => {
    const existing = prev[p.slug];
    const nextQty = existing ? existing.qty + desired : desired;

    // Safety: still ensure nextQty <= stock
    const max = maxAllowedForSlug(p.slug);
    if (nextQty > max) {
      setErrorMsg(`Not enough stock for ${p.slug}. Max: ${max}`);
      return prev;
    }

    return {
      ...prev,
      [p.slug]: {
        slug: p.slug,
        price: Number(p.price) || 0,
        is_weight: !!p.is_weight,
        qty: nextQty,
      },
    };
  });
}

function setCartQty(slug: string, qty: number, isWeight: boolean) {
  setSuccessMsg("");
  setErrorMsg("");

  const min = isWeight ? 0.01 : 1;
  const safe = clampMin(qty, min);

  const max = maxAllowedForSlug(slug);

  // Reject if they try to increase above stock
  if (safe > max) {
    setErrorMsg(`Cannot exceed stock for ${slug}. Max: ${max}`);
    return;
  }

  setCart((prev) => {
    if (!prev[slug]) return prev;
    return { ...prev, [slug]: { ...prev[slug], qty: safe } };
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

    // 1) create order
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

    // 2) create order_items
    const itemsPayload = cartItems.map((it) => ({
      order_id: orderId,
      product_slug: it.slug,
      qty: it.qty,
      unit_price: it.price,
      unit_cost: Number(productsBySlug[it.slug]?.cost ?? 0),
      line_total: Number((it.price * it.qty).toFixed(2)),
      is_weight: it.is_weight,
    }));

    const { error: itemsErr } = await supabase.from("order_items").insert(itemsPayload);
    if (itemsErr) {
      setErrorMsg(itemsErr.message);
      setPlacing(false);
      return;
    }

    // 3) recalc total (optional helper)
    await supabase.rpc("recalc_order_total", { p_order_id: orderId });
    await supabase.rpc("recalc_order_profit", { p_order_id: orderId });

    clearCart();
    setPhone("");
    setSuccessMsg(`Order placed! ID: ${orderId}. Status: pending (waiting confirmation).`);
    setPlacing(false);
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <div style={s.titleWrap}>
            <h1 style={s.title}>Online (Test Storefront)</h1>
            <p style={s.subtitle}>Add to cart → checkout with phone only → creates pending order</p>
          </div>
          <div style={s.badgeRow}>
            <span style={s.badge}>Items: {products.length}</span>
            <span style={s.badge}>Cart: {cartItems.length}</span>
          </div>
        </header>

        {errorMsg ? <div style={{ ...s.card, borderColor: "#f1c4c4" }}><div style={s.err}>{errorMsg}</div></div> : null}
        {successMsg ? <div style={{ ...s.card, borderColor: "#c7f0d1" }}><div style={{ fontWeight: 900 }}>{successMsg}</div></div> : null}

        <div className="online-shell" style={s.shell}>
          <section style={s.card}>
            <div style={s.cardTitleRow}>
              <h2 style={s.cardTitle}>Products</h2>
              <input style={s.search} placeholder="Search slug or tag…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <hr style={s.divider} />

            {loading ? (
              <div style={{ opacity: 0.75 }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No products found.</div>
            ) : (
              <div style={s.grid}>
                {filtered.map((p) => (
                  <div key={p.id} style={s.productCard}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <p style={s.slug}>{p.slug}</p>

                      <div style={s.meta}>
                        <div style={s.badgeRow}>
                          <span style={s.badge}>{p.is_weight ? "Weight (kg)" : "Unit"}</span>
                         <span style={s.badge}>In stock: {p.qty}</span>
<span style={s.badge}>Available: {availableQty(p.slug)}</span>
                        </div>
                        <div style={{ marginTop: 6 }}>
                          Price: <b>{money(Number(p.price) || 0)}</b>
                          {p.mrp ? <> • MRP: <span style={{ textDecoration: "line-through" }}>{money(Number(p.mrp) || 0)}</span></> : null}
                        </div>
                      </div>

                      {!!(p.tags?.length) ? (
                        <div style={s.tags}>
                          {p.tags.slice(0, 6).map((t) => <span key={t} style={s.tag}>{t}</span>)}
                        </div>
                      ) : null}
                    </div>

                    <div style={s.qtyRow}>
                      <input
                        style={s.input}
                        type="number"
                        step={p.is_weight ? "0.01" : "1"}
                        min={p.is_weight ? 0.01 : 1}
                        value={qtyDraft[p.slug] ?? "1"}
                        onChange={(e) => setQtyDraft((prev) => ({ ...prev, [p.slug]: e.target.value }))}
                      />
                      <button style={s.btn} onClick={() => addToCart(p)}>Add</button>
                    </div>

                    <div style={s.hint}>{p.is_weight ? "Qty is in kg (e.g. 0.50)" : "Qty is units (1,2,3…)"}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside style={{ ...s.card, position: "sticky", top: 12 }}>
            <div style={s.cardTitleRow}>
              <h2 style={s.cardTitle}>Cart</h2>
              <button style={s.btnGhost} type="button" onClick={clearCart} disabled={cartItems.length === 0}>Clear</button>
            </div>
            <hr style={s.divider} />

            {cartItems.length === 0 ? (
              <div style={{ opacity: 0.75 }}>Cart is empty.</div>
            ) : (
              <div style={s.cartList}>
                {cartItems.map((item) => {
                  const line = item.price * item.qty;
                  return (
                    <div key={item.slug} style={s.cartItem}>
                      <div style={s.cartTop}>
                        <div style={{ display: "grid", gap: 4 }}>
                          <p style={s.cartSlug}>{item.slug}</p>
                          <div style={s.cartMeta}>
                            <span style={s.badge}>{item.is_weight ? "kg" : "unit"}</span>
                            <span style={{ marginLeft: 8 }}>Price: {money(item.price)}</span>
                          </div>
                        </div>
                        <button style={s.btnDanger} type="button" onClick={() => removeFromCart(item.slug)}>Remove</button>
                      </div>

                      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                        <input
                          style={s.input}
                          type="number"
                          step={item.is_weight ? "0.01" : "1"}
                          min={item.is_weight ? 0.01 : 1}
                          value={String(item.qty)}
                          onChange={(e) => setCartQty(item.slug, Number(e.target.value), item.is_weight)}
                        />
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12, opacity: 0.8 }}>Line</div>
                          <div style={{ fontWeight: 950 }}>{money(line)}</div>
                        </div>
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
                      <select
                        style={{ ...s.input, width: "100%" }}
                        value={channel}
                        onChange={(e) => setChannel(e.target.value as OrderChannel)}
                      >
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