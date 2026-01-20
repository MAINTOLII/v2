
// This file has been replaced with the new POS component code.
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type Product = {
  id: string;
  slug: string;
  qty: number; // stock
  price: number;
  cost: number; // unit cost at current time
  tags: string[];
  is_weight: boolean;
};

type CartItem = {
  slug: string;
  base_price: number; // default product price
  price: number; // editable unit price used for sale
  is_weight: boolean;
  qty: number; // units or kg
};

type Customer = {
  id: string | number; // BIGINT in DB (may come back as number or string)
  name: string | null;
  phone: string | null; // stored as text like "336454"
  created_at?: string;
  is_trusted?: boolean;
  balance?: string | number;
  credit_limit?: string | number | null;
};

type CheckoutMode = "paid" | "credit";

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: 10,
    background: "#fafafa",
    minHeight: "100vh",
    color: "#111",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },
  container: {
    maxWidth: 720,
    margin: "0 auto",
    display: "grid",
    gap: 10,
  },
  stickyHeader: {
    position: "sticky",
    top: 0,
    zIndex: 30,
    background: "rgba(250,250,250,0.92)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    padding: "10px 12px",
    borderBottom: "1px solid #e5e7eb",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  headerCompact: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  chipRow: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  title: { margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" },
  sectionTitle: { margin: 0, fontSize: 16, fontWeight: 800 },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    fontSize: 12,
    fontWeight: 700,
    background: "#fff",
    whiteSpace: "nowrap",
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
  },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  input: {
    height: 38,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontSize: 14,
    background: "#fff",
  },
  btn: {
    height: 38,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
    opacity: 1,
  },
  btnGhost: {
    height: 38,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
    opacity: 1,
  },
  btnDanger: {
    height: 38,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #f1c4c4",
    background: "#fff",
    color: "#b42318",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
    opacity: 1,
  },
  list: { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 },
  li: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 10,
    display: "grid",
    gap: 6,
  },
  liTop: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" },
  small: { fontSize: 12, opacity: 0.75 },
  err: { color: "#b42318", fontWeight: 800, fontSize: 13 },
  ok: { color: "#067647", fontWeight: 800, fontSize: 13 },
};

function money(n: number) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function clampMin(v: number, min: number) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, v);
}

export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerPickOpen, setCustomerPickOpen] = useState(false);

  const [customerNumber, setCustomerNumber] = useState<string>("");
  const [query, setQuery] = useState<string>("");

  const [cart, setCart] = useState<Record<string, CartItem>>({});

  // prevents duplicate checkouts
  const [checkingOut, setCheckingOut] = useState(false);

  // UX controls
  const [cartOpen, setCartOpen] = useState(true);
  const MIN_SEARCH_CHARS = 4;

  const searchRef = useRef<HTMLInputElement | null>(null);
  const customerBoxRef = useRef<HTMLDivElement | null>(null);

  const productsBySlug = useMemo(() => {
    const map: Record<string, Product> = {};
    for (const p of products) map[p.slug] = p;
    return map;
  }, [products]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);

  const total = useMemo(
    () => cartItems.reduce((sum, it) => sum + it.price * it.qty, 0),
    [cartItems]
  );

  // keep profit calc (useful), but we won't show it in the UI to keep screen clean
  const profit = useMemo(() => {
    return cartItems.reduce((sum, it) => {
      const cost = Number(productsBySlug[it.slug]?.cost ?? 0);
      return sum + (it.price - cost) * it.qty;
    }, 0);
  }, [cartItems, productsBySlug]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < MIN_SEARCH_CHARS) return [];
    return products
      .filter(
        (p) =>
          p.slug.toLowerCase().includes(q) ||
          (p.tags ?? []).some((t) => String(t).toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [products, query]);

  const customerSuggestions = useMemo(() => {
    const q = customerNumber.trim();
    if (q.length < 2) return [] as Customer[];
    const qNorm = q.replace(/\s+/g, "");
    const qLower = qNorm.toLowerCase();

    return customers
      .filter((c) => {
        const p = c.phone == null ? "" : String(c.phone);
        const n = (c.name ?? "").toLowerCase();
        return p.startsWith(qNorm) || p.includes(qNorm) || n.includes(qLower);
      })
      .slice(0, 8);
  }, [customers, customerNumber]);

  const selectedCustomer = useMemo(() => {
    const q = customerNumber.trim().replace(/\s+/g, "");
    if (!q) return null;
    return customers.find((c) => (c.phone == null ? "" : String(c.phone)) === q) ?? null;
  }, [customers, customerNumber]);

  function maxAllowed(slug: string) {
    return Math.max(0, Number(productsBySlug[slug]?.qty ?? 0));
  }

  function inCart(slug: string) {
    return Number(cart[slug]?.qty ?? 0);
  }

  function available(slug: string) {
    return Math.max(0, maxAllowed(slug) - inCart(slug));
  }

  async function load() {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    const { data, error } = await supabase
      .from("products")
      .select("id,slug,qty,price,cost,tags,is_weight")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
      setProducts([]);
      setLoading(false);
      return;
    }

    setProducts((data ?? []) as Product[]);
    setLoading(false);

    // focus search for fast scanning
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  async function loadCustomers() {
    setCustomerLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("id,name,phone")
      .order("id", { ascending: false })
      .limit(2000);

    if (!error) setCustomers((data ?? []) as any);
    setCustomerLoading(false);
  }

  useEffect(() => {
    load();
    loadCustomers();
  }, []);

  // close customer dropdown on outside click
  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (customerBoxRef.current && !customerBoxRef.current.contains(t)) {
        setCustomerPickOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  function addOne(p: Product) {
    setErrorMsg("");
    setSuccessMsg("");

    const min = p.is_weight ? 0.01 : 1;
    const step = p.is_weight ? 0.25 : 1; // fast POS: add 0.25kg per click

    const avail = available(p.slug);
    if (avail <= 0) {
      setErrorMsg(`Out of stock: ${p.slug}`);
      return;
    }

    if (step > avail) {
      setErrorMsg(`Not enough stock for ${p.slug}. Available: ${avail}`);
      return;
    }

    setCart((prev) => {
      const existing = prev[p.slug];
      const nextQty = existing ? existing.qty + step : clampMin(step, min);
      const max = maxAllowed(p.slug);
      if (nextQty > max) {
        setErrorMsg(`Not enough stock for ${p.slug}. Max: ${max}`);
        return prev;
      }
      return {
        ...prev,
        [p.slug]: {
          slug: p.slug,
          base_price: Number(p.price) || 0,
          price: Number(existing?.price ?? p.price) || 0,
          is_weight: !!p.is_weight,
          qty: nextQty,
        },
      };
    });

    // collapse search dropdown after adding item
    setQuery("");

    // keep search text for quick repeat scanning; select all text
    setTimeout(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    }, 0);
  }

  function setQty(slug: string, qty: number, isWeight: boolean) {
    setErrorMsg("");
    setSuccessMsg("");

    const min = isWeight ? 0.01 : 1;
    const safe = clampMin(Number(qty), min);
    const max = maxAllowed(slug);

    if (safe > max) {
      setErrorMsg(`Cannot exceed stock for ${slug}. Max: ${max}`);
      return;
    }

    setCart((prev) => {
      if (!prev[slug]) return prev;
      return { ...prev, [slug]: { ...prev[slug], qty: safe } };
    });
  }

  function setUnitPrice(slug: string, price: number) {
    setErrorMsg("");
    setSuccessMsg("");

    const safe = Number(price);
    if (!Number.isFinite(safe) || safe < 0) {
      setErrorMsg("Invalid price.");
      return;
    }

    setCart((prev) => {
      if (!prev[slug]) return prev;
      return { ...prev, [slug]: { ...prev[slug], price: Number(safe.toFixed(2)) } };
    });
  }

  function remove(slug: string) {
    setCart((prev) => {
      const next = { ...prev };
      delete next[slug];
      return next;
    });
  }

  function clearCartOnly() {
    setCart({});
    setQuery("");
  }

  function clearAllAfterCheckout() {
    setCart({});
    setQuery("");
    setCustomerNumber("");
    setCustomerPickOpen(false);
  }

  async function ensureCustomer(phoneText: string) {
    const norm = phoneText.trim().replace(/\s+/g, "");

    // allow any number (3+ digits)
    if (!/^\d{3,}$/.test(norm)) throw new Error("Invalid customer number");

    // local cache
    const existingLocal = customers.find((c) => String(c.phone ?? "") === norm);
    if (existingLocal) return existingLocal;

    // DB check (phone is TEXT)
    const { data: found, error: findErr } = await supabase
      .from("customers")
      .select("id,name,phone")
      .eq("phone", norm)
      .maybeSingle();

    if (!findErr && found) {
      const c = found as any as Customer;
      setCustomers((prev) => (prev.some((x) => String(x.id) === String(c.id)) ? prev : [c, ...prev]));
      return c;
    }

    // create ONLY when checkout calls this
    // customers.id is BIGINT in your DB, so we use the numeric phone as the id.
    const phoneNum = Number(norm);
    if (!Number.isFinite(phoneNum)) throw new Error("Invalid customer number");

    const { data, error } = await supabase
      .from("customers")
      .insert({ id: phoneNum, phone: norm })
      .select("id,name,phone")
      .single();

    if (error) throw error;

    const created = data as any as Customer;
    setCustomers((prev) => {
      if (prev.some((x) => String(x.id) === String(created.id))) return prev;
      return [created, ...prev];
    });
    return created;
  }

  async function checkoutPOS(mode: CheckoutMode) {
    // prevent duplicate checkouts (double click / slow network)
    if (checkingOut) return;

    setCheckingOut(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const phone = customerNumber.trim();
      if (!phone) {
        setErrorMsg("Customer number is required.");
        return;
      }
      if (cartItems.length === 0) {
        setErrorMsg("Cart is empty.");
        return;
      }

      // ensure customer exists (and avoid duplicates)
      let customer: Customer | null = null;
      try {
        customer = await ensureCustomer(phone);
        void customer;
      } catch (e: any) {
        setErrorMsg(e?.message ?? "Failed to create/find customer");
        return;
      }

      // validate stock again
      for (const it of cartItems) {
        const stock = maxAllowed(it.slug);
        if (it.qty > stock) {
          setErrorMsg(`Not enough stock for ${it.slug}. In cart: ${it.qty}, Stock: ${stock}`);
          return;
        }
      }

      // Create order as pending (because confirm_order expects pending)
      const { data: orderRow, error: orderErr } = await supabase
        .from("orders")
        .insert({
          phone,
          status: "pending",
          channel: "pos",
          total: 0,
          note: mode === "credit" ? "CREDIT" : null,
        })
        .select("id")
        .single();

      if (orderErr || !orderRow?.id) {
        setErrorMsg(orderErr?.message ?? "Failed to create order");
        return;
      }

      const orderId = orderRow.id as string;

      // Insert order items
      const payload = cartItems.map((it) => ({
        order_id: orderId,
        product_slug: it.slug,
        qty: it.qty,
        unit_price: it.price,
        unit_cost: Number(productsBySlug[it.slug]?.cost ?? 0),
        line_total: Number((it.price * it.qty).toFixed(2)),
        is_weight: it.is_weight,
      }));

      const { error: itemsErr } = await supabase.from("order_items").insert(payload);
      if (itemsErr) {
        setErrorMsg(itemsErr.message);
        return;
      }

      // recalc totals/profit
      await supabase.rpc("recalc_order_total", { p_order_id: orderId });
      await supabase.rpc("recalc_order_profit", { p_order_id: orderId });

      // POS reduces stock immediately + marks completed:
      // confirm (reduces stock) then complete.
      const { error: confErr } = await supabase.rpc("confirm_order", { p_order_id: orderId });
      if (confErr) {
        console.error("confirm_order failed", confErr);
        setErrorMsg(confErr.message);
        return;
      }

      const { error: compErr } = await supabase.rpc("complete_order", { p_order_id: orderId });
      if (compErr) {
        console.error("complete_order failed", compErr);
        setErrorMsg(compErr.message);
        return;
      }

      if (mode === "credit") {
        const amount = Number(total.toFixed(2));
        const { error: credErr } = await supabase
          .from("credits")
          .insert({
            // NOTE: credits.customer_id is BIGINT in your DB, but customers.id is UUID.
            // So we do NOT write the UUID into customer_id.
            customer_id: null,
            customer_phone: Number(phone),
            order_id: orderId,
            amount,
            status: "open",
          } as any);

        if (credErr) {
          console.error("credits insert failed", credErr);
          setSuccessMsg(`✅ Completed (CREDIT). Order: ${orderId}. (But credit record failed: ${credErr.message})`);
        } else {
          setSuccessMsg(`✅ Completed (CREDIT). Order: ${orderId}. Saved to credits.`);
        }
      } else {
        setSuccessMsg(`✅ Completed (PAID). Order: ${orderId}.`);
      }

      clearAllAfterCheckout();
      await load(); // refresh stock
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <div style={s.stickyHeader}>
          <div style={s.headerCompact}>
            <h1 style={s.title}>POS</h1>
            <div style={s.chipRow}>
              <span style={s.badge}>Cart: {cartItems.length}</span>
              <span style={s.badge}>Total: {money(total)}</span>
              <button
                type="button"
                style={{
                  ...s.btnGhost,
                  height: 34,
                  padding: "0 10px",
                  borderRadius: 999,
                  opacity: checkingOut ? 0.6 : 1,
                  cursor: checkingOut ? "not-allowed" : "pointer",
                }}
                onClick={() => {
                  if (checkingOut) return;
                  setCartOpen((v) => !v);
                }}
                disabled={checkingOut}
              >
                {cartOpen ? "Hide cart" : "Show cart"}
              </button>
            </div>
          </div>
        </div>

        {(errorMsg || successMsg) && (
          <div style={{ ...s.card, borderColor: errorMsg ? "#f1c4c4" : "#c7f0d1" }}>
            {errorMsg ? <div style={s.err}>{errorMsg}</div> : null}
            {successMsg ? <div style={s.ok}>{successMsg}</div> : null}
          </div>
        )}

        <div style={s.card}>
          <div ref={customerBoxRef} style={{ position: "relative" }}>
            <div style={s.row}>
              <input
                style={{ ...s.input, flex: 1, minWidth: 220 }}
                placeholder={customerLoading ? "Loading customers…" : "Customer number"}
                value={customerNumber}
                onChange={(e) => {
                  setCustomerNumber(e.target.value);
                  setCustomerPickOpen(true);
                }}
                onFocus={() => setCustomerPickOpen(true)}
                disabled={checkingOut}
              />

              {selectedCustomer ? (
                <span style={s.badge}>
                  {(selectedCustomer.name ?? "Customer")} • {selectedCustomer.phone}
                </span>
              ) : null}

              <button
                style={{
                  ...s.btnGhost,
                  opacity: checkingOut ? 0.6 : 1,
                  cursor: checkingOut ? "not-allowed" : "pointer",
                }}
                type="button"
                onClick={() => {
                  if (checkingOut) return;
                  setCustomerNumber("");
                  setCustomerPickOpen(false);
                }}
                disabled={checkingOut}
              >
                Clear
              </button>
            </div>

            {customerPickOpen && customerSuggestions.length > 0 ? (
              <div
                style={{
                  position: "absolute",
                  zIndex: 20,
                  top: 44,
                  left: 0,
                  right: 0,
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 6,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
                }}
              >
                {customerSuggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCustomerNumber(String(c.phone ?? ""));
                      setCustomerPickOpen(false);
                      setTimeout(() => searchRef.current?.focus(), 0);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 10px",
                      borderRadius: 10,
                      border: "1px solid transparent",
                      background: "#fff",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {(c.name ?? "Customer")} — {c.phone}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div style={{ height: 10 }} />

          <div style={s.row}>
            <input
              ref={searchRef}
              style={{ ...s.input, flex: 1, minWidth: 260 }}
              placeholder={loading ? "Loading products…" : `Search item (type ${MIN_SEARCH_CHARS}+ chars)`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading || checkingOut}
            />
            <button
              style={{
                ...s.btnGhost,
                opacity: checkingOut ? 0.6 : 1,
                cursor: checkingOut ? "not-allowed" : "pointer",
              }}
              type="button"
              onClick={() => {
                if (checkingOut) return;
                setQuery("");
                searchRef.current?.focus();
              }}
              disabled={checkingOut}
            >
              Clear
            </button>
          </div>

          <div style={s.small}>Tip: type and tap Add. (Weight adds 0.25kg per tap.)</div>

          {query.trim().length > 0 && query.trim().length < MIN_SEARCH_CHARS ? (
            <div style={{ ...s.small, marginTop: 10, opacity: 0.7 }}>
              Type {MIN_SEARCH_CHARS}+ characters to search…
            </div>
          ) : null}

          {query.trim().length >= MIN_SEARCH_CHARS && (
            <ul style={{ ...s.list, marginTop: 10 }}>
              {filtered.length === 0 ? (
                <li style={{ ...s.li, opacity: 0.7 }}>No match.</li>
              ) : (
                filtered.map((p) => (
                  <li key={p.id} style={s.li}>
                    <div style={s.liTop}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{p.slug}</div>
                        <div style={s.small}>
                          {p.is_weight ? "kg" : "unit"} • {money(p.price)} • stock {p.qty}
                        </div>
                      </div>
                      <button
                        style={{
                          ...s.btn,
                          opacity: checkingOut ? 0.6 : 1,
                          cursor: checkingOut ? "not-allowed" : "pointer",
                        }}
                        type="button"
                        onClick={() => {
                          if (checkingOut) return;
                          addOne(p);
                        }}
                        disabled={checkingOut}
                      >
                        Add
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <div style={s.card}>
          <div style={s.headerCompact}>
            <h2 style={s.sectionTitle}>Cart</h2>
            <div style={s.row}>
              <button
                style={{
                  ...s.btnGhost,
                  opacity: cartItems.length === 0 || checkingOut ? 0.6 : 1,
                  cursor: cartItems.length === 0 || checkingOut ? "not-allowed" : "pointer",
                }}
                type="button"
                onClick={() => {
                  if (checkingOut) return;
                  clearCartOnly();
                }}
                disabled={cartItems.length === 0 || checkingOut}
              >
                Clear cart
              </button>

              <button
                style={{
                  ...s.btn,
                  opacity: cartItems.length === 0 || checkingOut ? 0.6 : 1,
                  cursor: cartItems.length === 0 || checkingOut ? "not-allowed" : "pointer",
                }}
                type="button"
                onClick={() => checkoutPOS("paid")}
                disabled={cartItems.length === 0 || checkingOut}
              >
                {checkingOut ? "Processing…" : "Checkout (Paid)"}
              </button>

              <button
                style={{
                  ...s.btnGhost,
                  opacity: cartItems.length === 0 || checkingOut ? 0.6 : 1,
                  cursor: cartItems.length === 0 || checkingOut ? "not-allowed" : "pointer",
                }}
                type="button"
                onClick={() => checkoutPOS("credit")}
                disabled={cartItems.length === 0 || checkingOut}
              >
                {checkingOut ? "Processing…" : "Checkout (Credit)"}
              </button>
            </div>
          </div>

          {!cartOpen ? (
            <div style={{ opacity: 0.7 }}>Cart hidden.</div>
          ) : cartItems.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Empty.</div>
          ) : (
            <ul style={s.list}>
              {cartItems.map((it) => {
                const max = maxAllowed(it.slug);
                const line = it.price * it.qty;
                return (
                  <li key={it.slug} style={s.li}>
                    <div style={s.liTop}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{it.slug}</div>
                        <div style={s.small}>
                          {it.is_weight ? "kg" : "unit"} • unit {money(it.price)}
                          {Number(it.base_price) !== Number(it.price)
                            ? ` (default ${money(it.base_price)})`
                            : ""} • stock {max}
                        </div>
                      </div>
                      <button
                        style={{
                          ...s.btnDanger,
                          opacity: checkingOut ? 0.6 : 1,
                          cursor: checkingOut ? "not-allowed" : "pointer",
                        }}
                        type="button"
                        onClick={() => {
                          if (checkingOut) return;
                          remove(it.slug);
                        }}
                        disabled={checkingOut}
                      >
                        Remove
                      </button>
                    </div>

                    <div style={s.row}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            border: "1px solid #e5e7eb",
                            background: "#fff",
                            fontWeight: 900,
                            fontSize: 18,
                            cursor: checkingOut ? "not-allowed" : "pointer",
                            opacity: checkingOut ? 0.6 : 1,
                          }}
                          disabled={checkingOut}
                          onClick={() => {
                            const step = it.is_weight ? 0.25 : 1;
                            const min = it.is_weight ? 0.01 : 1;
                            const next = Number(it.qty) - step;
                            const safe = Number.isFinite(next) ? next : min;
                            setQty(it.slug, safe < min ? min : safe, it.is_weight);
                          }}
                        >
                          −
                        </button>

                        <input
                          inputMode={it.is_weight ? "decimal" : "numeric"}
                          style={{
                            height: 44,
                            width: 90,
                            textAlign: "center",
                            borderRadius: 12,
                            border: "1px solid #e5e7eb",
                            outline: "none",
                            fontSize: 16,
                            fontWeight: 900,
                            background: "#fff",
                            padding: "0 10px",
                          }}
                          type="number"
                          step={it.is_weight ? "0.25" : "1"}
                          min={it.is_weight ? 0.01 : 1}
                          value={String(it.qty)}
                          onChange={(e) => setQty(it.slug, Number(e.target.value), it.is_weight)}
                          disabled={checkingOut}
                        />

                        <button
                          type="button"
                          aria-label="Increase quantity"
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            border: "1px solid #e5e7eb",
                            background: "#fff",
                            fontWeight: 900,
                            fontSize: 18,
                            cursor: checkingOut ? "not-allowed" : "pointer",
                            opacity: checkingOut ? 0.6 : 1,
                          }}
                          disabled={checkingOut}
                          onClick={() => {
                            const step = it.is_weight ? 0.25 : 1;
                            const min = it.is_weight ? 0.01 : 1;
                            const next = Number(it.qty) + step;
                            const safe = Number.isFinite(next) ? next : min;
                            setQty(it.slug, safe, it.is_weight);
                          }}
                        >
                          +
                        </button>
                      </div>

                      <input
                        style={{ ...s.input, width: 140 }}
                        type="number"
                        step="0.01"
                        min={0}
                        value={String(it.price)}
                        onChange={(e) => setUnitPrice(it.slug, Number(e.target.value))}
                        disabled={checkingOut}
                        placeholder="Unit price"
                      />

                      <span style={s.badge}>Line: {money(line)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div style={{ textAlign: "center", fontSize: 12, opacity: 0.6 }}>
          POS creates channel=pos and completes immediately (confirm → complete). Checkout is locked while processing to prevent duplicates.
        </div>
      </div>
    </main>
  );
}