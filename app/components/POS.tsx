"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type Product = {
  id: string;
  slug: string;
  qty: number;
  price: number;
  cost: number;
  tags: string[];
  is_weight: boolean;

  // ✅ NEW DB: product -> subsubcategories
  // DB column name:
  subsubcategory_id?: string | number | null;
};

type Subsub = {
  id: string | number;
  slug: string;
};

type Customer = {
  id: string | number;
  name: string | null;
  phone: string | number | null;
};

type CartItem = {
  key: string; // unique per row
  slug: string; // product slug (or custom name if you add later)
  is_weight: boolean;
  qty: number;
  unit_price: number;
  unit_cost: number;
  is_custom?: boolean;
};

type CheckoutMode = "paid" | "credit";

type DaySummary = {
  revenue: number;
  cost: number;
  profit: number;
  count: number;
};

const cssVars: React.CSSProperties = {
  // @ts-ignore
  "--red": "#e60000",
  // @ts-ignore
  "--black": "#111",
  // @ts-ignore
  "--white": "#fff",
  // @ts-ignore
  "--grey": "#888",
} as any;

const s: Record<string, React.CSSProperties> = {
  page: {
    ...cssVars,
    fontFamily: "Arial, sans-serif",
    margin: 0,
    background: "#fff",
    color: "#111",
    minHeight: "100vh",
  },

  header: {
    backgroundColor: "var(--red)",
    padding: "15px 20px",
    textAlign: "center",
    fontSize: "1.8rem",
    fontWeight: "bold",
    color: "white",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },

  topButtons: {
    marginTop: 10,
    display: "flex",
    gap: 10,
    justifyContent: "center",
    flexWrap: "wrap",
  },

  topBtn: {
    background: "white",
    color: "var(--red)",
    border: "1px solid var(--red)",
    borderRadius: 6,
    padding: "6px 12px",
    cursor: "pointer",
    fontWeight: "bold",
  },

  dailySummary: {
    background: "#f5f5f5",
    padding: "10px 20px",
    textAlign: "center",
    fontWeight: "bold",
  },

  controls: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    padding: 10,
    background: "#f9f9f9",
    alignItems: "center",
  },

  categoryBtn: {
    padding: "8px 14px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    background: "#ddd",
    fontWeight: "bold",
  },

  categoryBtnActive: { background: "var(--red)", color: "white" },

  productsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 15,
    padding: 15,
  },

  productCard: {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: 15,
    textAlign: "center",
  },

  productName: {
    fontWeight: "bold",
    marginBottom: 8,
    wordBreak: "break-word",
  },

  productPrice: {
    color: "var(--red)",
    fontWeight: "bold",
    cursor: "pointer",
  },

  addToCart: {
    marginTop: 10,
    background: "var(--red)",
    color: "white",
    border: "none",
    padding: 8,
    borderRadius: 6,
    cursor: "pointer",
    width: "100%",
    fontWeight: "bold",
  },

  // customer
  customerWrap: { padding: 15, position: "relative" },

  customerInput: {
    padding: 10,
    width: "90%",
    border: "1px solid #ccc",
    borderRadius: 8,
    outline: "none",
  },

  suggestions: {
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "white",
    position: "absolute",
    zIndex: 1000,
    width: "90%",
    maxHeight: 200,
    overflowY: "auto",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    marginTop: 6,
  },

  suggestionItem: {
    padding: 10,
    borderBottom: "1px solid #eee",
    cursor: "pointer",
    textAlign: "left",
    background: "#fff",
  },

  // used for Search block now
  customBox: {
    padding: 15,
    border: "1px solid #ddd",
    borderRadius: 8,
    margin: 15,
  },

  // floating buttons
  checkoutBtn: {
    position: "fixed",
    bottom: 20,
    right: 20,
    background: "var(--red)",
    color: "white",
    padding: "14px 18px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
    zIndex: 2000,
  },

  viewSalesBtn: {
    position: "fixed",
    bottom: 20,
    left: 20,
    background: "#333",
    color: "white",
    padding: "14px 18px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
    zIndex: 2000,
  },

  // modal
  modalOverlay: {
    display: "flex",
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10000,
    padding: 12,
  },

  modal: {
    background: "white",
    padding: 20,
    borderRadius: 10,
    maxWidth: 520,
    width: "90%",
    maxHeight: "80%",
    overflowY: "auto",
  },

  table: { width: "100%", borderCollapse: "collapse", marginBottom: 15 },

  th: {
    borderBottom: "1px solid #ccc",
    textAlign: "left",
    padding: 5,
    fontWeight: "bold",
  },

  td: { borderBottom: "1px solid #ccc", textAlign: "left", padding: 5 },

  qtyInput: {
    width: 70,
    padding: 6,
    borderRadius: 6,
    border: "1px solid #ccc",
  },

  priceInput: {
    width: 90,
    padding: 6,
    borderRadius: 6,
    border: "1px solid #ccc",
  },

  removeBtn: {
    color: "red",
    border: "none",
    background: "none",
    cursor: "pointer",
    fontWeight: "bold",
  },

  confirmBtn: {
    background: "var(--red)",
    color: "white",
    padding: "10px 15px",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: "bold",
  },

  cancelBtn: {
    marginLeft: 10,
    padding: "10px 15px",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },

  msg: { textAlign: "center", padding: "10px 15px", fontWeight: "bold" },
  msgErr: { color: "#b42318" },
  msgOk: { color: "#067647" },
};

function money(n: number) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function startOfDayISO(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

function normalizePhoneDigits(input: string) {
  return String(input || "").replace(/\D/g, "");
}

export default function POS() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [daySummary, setDaySummary] = useState<DaySummary>({
    revenue: 0,
    cost: 0,
    profit: 0,
    count: 0,
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [subsubs, setSubsubs] = useState<Subsub[]>([]);
  const [subsubById, setSubsubById] = useState<Record<string, string>>({});

  const [currentSubsub, setCurrentSubsub] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerInput, setCustomerInput] = useState("");
  const [customerPickOpen, setCustomerPickOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>("paid");
  const [checkingOut, setCheckingOut] = useState(false);

  const CART_STORAGE_KEY = "pos_cart_v1";

  // Click row -> edit -> Save (supports editing Total for bulk deals)
  const [rowEditKey, setRowEditKey] = useState<string | null>(null);
  const [rowDraftQty, setRowDraftQty] = useState<string>("");
  const [rowDraftUnitPrice, setRowDraftUnitPrice] = useState<string>("");
  const [rowDraftTotal, setRowDraftTotal] = useState<string>("");

  const customerBoxRef = useRef<HTMLDivElement | null>(null);

  const productsBySlug = useMemo(() => {
    const map: Record<string, Product> = {};
    for (const p of products) map[p.slug] = p;
    return map;
  }, [products]);

  const cartTotals = useMemo(() => {
    const revenue = cart.reduce((sum, it) => sum + Number(it.qty || 0) * Number(it.unit_price || 0), 0);
    const cost = cart.reduce((sum, it) => sum + Number(it.qty || 0) * Number(it.unit_cost || 0), 0);
    return { revenue, cost, profit: revenue - cost };
  }, [cart]);

  const customerSuggestions = useMemo(() => {
    const q = customerInput.trim();
    if (!q) return [] as Customer[];

    const qDigits = normalizePhoneDigits(q);
    const qLower = q.toLowerCase();

    // ✅ performance/UX: only start suggesting after 3+ letters OR 3+ digits
    const has3Digits = qDigits.length >= 3;
    const has3Letters = qLower.replace(/[^a-z]/g, "").length >= 3;
    if (!has3Digits && !has3Letters) return [] as Customer[];

    return customers
      .filter((c) => {
        const p = c.phone == null ? "" : String(c.phone);
        const n = (c.name ?? "").toLowerCase();
        return (has3Digits ? p.includes(qDigits) : false) || (has3Letters ? n.includes(qLower) : false);
      })
      .slice(0, 10);
  }, [customers, customerInput]);

  const showCustomerDropdown = useMemo(() => {
    const q = customerInput.trim();
    if (!q) return false;
    const qDigits = normalizePhoneDigits(q);
    const qLower = q.toLowerCase();
    const has3Digits = qDigits.length >= 3;
    const has3Letters = qLower.replace(/[^a-z]/g, "").length >= 3;
    return has3Digits || has3Letters;
  }, [customerInput]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = products;

    // Only filter by category when NOT searching
    if (!term) {
      if (currentSubsub !== "all") {
        list = list.filter((p) => String(p.subsubcategory_id ?? "") === currentSubsub);
      }
      return list;
    }

    // When searching: hide categories + show results by search only
    list = list.filter((p) => (p.slug ?? "").toLowerCase().includes(term));
    return list;
  }, [products, currentSubsub, search]);

  function safeParseJSON<T>(raw: string | null): T | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  function clearCartAndPersisted() {
    setCart([]);
    setCheckoutOpen(false);
    setRowEditKey(null);
    setErrorMsg("");
    setSuccessMsg("Cart cleared.");
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {}
  }

  function beginRowEdit(it: CartItem) {
    setRowEditKey(it.key);
    setRowDraftQty(String(it.qty));
    setRowDraftUnitPrice(String(it.unit_price));
    setRowDraftTotal(String(Number((it.qty * it.unit_price).toFixed(2))));
  }

  function cancelRowEdit() {
    setRowEditKey(null);
    setRowDraftQty("");
    setRowDraftUnitPrice("");
    setRowDraftTotal("");
  }

  function commitRowEdit(key: string) {
    const qty = Number(rowDraftQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErrorMsg("Invalid quantity");
      return;
    }

    let unitPrice: number;
    const total = Number(rowDraftTotal);
    const typedUnit = Number(rowDraftUnitPrice);

    // If TOTAL was manually entered, lock it in exactly as typed
    if (rowDraftTotal.trim() !== "" && Number.isFinite(total) && total >= 0) {
      unitPrice = total / qty; // do NOT round here
    } else {
      unitPrice = typedUnit;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setErrorMsg("Invalid price");
      return;
    }

    setCart((prev) =>
      prev.map((it) =>
        it.key !== key
          ? it
          : {
              ...it,
              qty,
              // store exact unit price (no forced rounding)
              unit_price: unitPrice,
            }
      )
    );

    cancelRowEdit();
  }

  async function loadSubsubs() {
    const { data, error } = await supabase.from("subsubcategories").select("id,slug").order("id", { ascending: true });

    if (!error) {
      const list = (data ?? []) as any as Subsub[];
      setSubsubs(list);

      const map: Record<string, string> = {};
      for (const ss of list) map[String(ss.id)] = ss.slug;
      setSubsubById(map);
    }
  }

  async function loadProducts() {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    const { data, error } = await supabase
      .from("products")
      .select("id,slug,qty,price,cost,tags,is_weight,subsubcategory_id")
      .order("id", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
      setProducts([]);
      setLoading(false);
      return;
    }

    setProducts((data ?? []) as any as Product[]);
    setLoading(false);
  }

  async function loadCustomers() {
    const { data, error } = await supabase.from("customers").select("id,name,phone").order("id", { ascending: false }).limit(4000);
    if (!error) setCustomers((data ?? []) as any);
  }

  async function loadDailySummary() {
    const fromISO = startOfDayISO(new Date());

    const { data: orderRows, error: oErr } = await supabase
      .from("orders")
      .select("id,created_at,status,channel")
      .eq("channel", "pos")
      .eq("status", "completed")
      .gte("created_at", fromISO);

    if (oErr) return;

    const orders = (orderRows ?? []) as any[];
    const ids = orders.map((o) => o.id).filter(Boolean);

    let revenue = 0;
    let cost = 0;

    if (ids.length > 0) {
      const { data: itemRows } = await supabase.from("order_items").select("order_id,qty,unit_cost,line_total").in("order_id", ids);

      const items = (itemRows ?? []) as any[];
      revenue = items.reduce((s2, it) => s2 + Number(it.line_total || 0), 0);
      cost = items.reduce((s2, it) => s2 + Number(it.unit_cost || 0) * Number(it.qty || 0), 0);
    }

    setDaySummary({ revenue, cost, profit: revenue - cost, count: orders.length });
  }

  useEffect(() => {
    // Restore cart/customer draft if tab was closed
    try {
      const saved = safeParseJSON<{
        cart: CartItem[];
        customerInput: string;
        checkoutMode: CheckoutMode;
      }>(localStorage.getItem(CART_STORAGE_KEY));

      if (saved?.cart?.length) setCart(saved.cart);
      if (typeof saved?.customerInput === "string") setCustomerInput(saved.customerInput);
      if (saved?.checkoutMode) setCheckoutMode(saved.checkoutMode);
    } catch {}

    loadSubsubs();
    loadProducts();
    loadCustomers();
    loadDailySummary();
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

  // Persist cart + customer input until cleared
  useEffect(() => {
    try {
      const payload = { cart, customerInput, checkoutMode };
      if ((cart?.length ?? 0) > 0 || (customerInput?.trim() ?? "") !== "") {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
      } else {
        localStorage.removeItem(CART_STORAGE_KEY);
      }
    } catch {}
  }, [cart, customerInput, checkoutMode]);

  function addToCartFromProduct(p: Product) {
    setErrorMsg("");
    setSuccessMsg("");

    let qty = 1;

    if (p.is_weight) {
      const raw = prompt("Enter weight (kg):", "1");
      const w = Number(raw);
      if (!Number.isFinite(w) || w <= 0) {
        setErrorMsg("Invalid weight");
        return;
      }
      qty = w;
    }

    const stock = Math.max(0, Number(p.qty ?? 0));
    if (qty > stock) {
      setErrorMsg(`Not enough stock for ${p.slug}. Stock: ${stock}`);
      return;
    }

    const key = `${p.slug}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setCart((prev) => [
      ...prev,
      {
        key,
        slug: p.slug,
        is_weight: !!p.is_weight,
        qty,
        unit_price: Number(p.price || 0),
        unit_cost: Number(p.cost || 0),
        is_custom: false,
      },
    ]);
  }

  function removeCartItem(key: string) {
    setCart((prev) => prev.filter((it) => it.key !== key));
    if (rowEditKey === key) cancelRowEdit();
  }

  async function ensureCustomerFromInput() {
    // picked existing
    if (selectedCustomer?.phone != null) {
      return { name: selectedCustomer.name ?? null, phone: String(selectedCustomer.phone) };
    }

    const raw = customerInput.trim();
    if (!raw) throw new Error("Enter customer name or phone");

    const phoneDigits = normalizePhoneDigits(raw);
    if (!phoneDigits) throw new Error("Customer phone is required (type a phone number)");

    const nameGuess = raw.replace(phoneDigits, "").replace(/[()]/g, "").trim();

    const { data: found, error: findErr } = await supabase.from("customers").select("id,name,phone").eq("phone", phoneDigits).maybeSingle();

    if (!findErr && found) {
      return { name: (found as any).name ?? null, phone: String((found as any).phone ?? phoneDigits) };
    }

    // your DB uses bigint id=phone
    const phoneNum = Number(phoneDigits);
    if (!Number.isFinite(phoneNum)) throw new Error("Invalid phone");

    const { data: created, error: insErr } = await supabase
      .from("customers")
      .insert({ id: phoneNum, phone: phoneDigits, name: nameGuess || null })
      .select("id,name,phone")
      .single();

    if (insErr) throw insErr;

    return { name: (created as any).name ?? null, phone: String((created as any).phone ?? phoneDigits) };
  }

  async function checkoutPOS() {
    if (checkingOut) return;

    setCheckingOut(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (cart.length === 0) throw new Error("Cart is empty!");

      const cust = await ensureCustomerFromInput();
      const phone = cust.phone;

      // validate stock for real products only
      for (const it of cart) {
        const p = productsBySlug[it.slug];
        if (!p) continue;
        const stock = Math.max(0, Number(p.qty ?? 0));
        if (it.qty > stock) throw new Error(`Not enough stock for ${it.slug}. In cart: ${it.qty}, Stock: ${stock}`);
      }

      const { data: orderRow, error: orderErr } = await supabase
        .from("orders")
        .insert({
          phone,
          status: "pending",
          channel: "pos",
          total: 0,
          note: checkoutMode === "credit" ? "CREDIT" : null,
        })
        .select("id")
        .single();

      if (orderErr || !orderRow?.id) throw new Error(orderErr?.message ?? "Failed to create order");

      const orderId = orderRow.id as string;

      const payload = cart
        .filter((it) => !!productsBySlug[it.slug])
        .map((it) => ({
          order_id: orderId,
          product_slug: it.slug,
          qty: it.qty,
          unit_price: it.unit_price,
          unit_cost: Number(productsBySlug[it.slug]?.cost ?? it.unit_cost ?? 0),
          line_total: Number((it.unit_price * it.qty).toFixed(2)),
          is_weight: it.is_weight,
        }));

      if (payload.length === 0) throw new Error("No valid product items to checkout.");

      const { error: itemsErr } = await supabase.from("order_items").insert(payload);
      if (itemsErr) throw new Error(itemsErr.message);

      await supabase.rpc("recalc_order_total", { p_order_id: orderId });
      await supabase.rpc("recalc_order_profit", { p_order_id: orderId });

      const { error: confErr } = await supabase.rpc("confirm_order", { p_order_id: orderId });
      if (confErr) throw new Error(confErr.message);

      const { error: compErr } = await supabase.rpc("complete_order", { p_order_id: orderId });
      if (compErr) throw new Error(compErr.message);

      if (checkoutMode === "credit") {
        const amount = Number(cartTotals.revenue.toFixed(2));
        await supabase
          .from("credits")
          .insert({
            customer_id: null,
            customer_phone: Number(phone),
            order_id: orderId,
            amount,
            status: "open",
          } as any);
      }

      setSuccessMsg(`Checkout complete! Order: ${orderId}`);
      setCart([]);
      try {
        localStorage.removeItem(CART_STORAGE_KEY);
      } catch {}
      setCheckoutOpen(false);
      setSelectedCustomer(null);
      setCustomerInput("");
      cancelRowEdit();

      await loadProducts();
      await loadDailySummary();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Checkout failed");
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <main style={s.page}>
      <header style={s.header}>
        Products
        {/* <div style={s.topButtons}>
          <button type="button" style={s.topBtn} onClick={() => (window.location.href = "/customers")}>
            Customers
          </button>
          <button type="button" style={s.topBtn} onClick={() => (window.location.href = "/credit")}>
            Deyn
          </button>
        </div> */}
      </header>

      <div style={s.dailySummary}>
        {loading
          ? "Loading daily totals..."
          : `📊 Today — Sales: ${daySummary.count} | Revenue: ${money(daySummary.revenue)} | Cost: ${money(daySummary.cost)} | PNL: ${money(daySummary.profit)}`}
      </div>

      {errorMsg ? <div style={{ ...s.msg, ...s.msgErr }}>{errorMsg}</div> : null}
      {successMsg ? <div style={{ ...s.msg, ...s.msgOk }}>{successMsg}</div> : null}

      {/* CUSTOMER INPUT */}
      <div style={s.customerWrap} ref={customerBoxRef}>
        <label>
          <b>Customer:</b>
        </label>
        <br />
        <input
          type="text"
          value={customerInput}
          placeholder="Enter customer name or phone..."
          style={s.customerInput}
          autoComplete="off"
          onChange={(e) => {
            const v = e.target.value;
            setCustomerInput(v);
            setSelectedCustomer(null);

            const d = normalizePhoneDigits(v);
            const letters = v.toLowerCase().replace(/[^a-z]/g, "");
            const ok = d.length >= 3 || letters.length >= 3;
            setCustomerPickOpen(ok);
          }}
          onFocus={() => {
            const d = normalizePhoneDigits(customerInput);
            const letters = customerInput.toLowerCase().replace(/[^a-z]/g, "");
            const ok = d.length >= 3 || letters.length >= 3;
            setCustomerPickOpen(ok);
          }}
          disabled={checkingOut}
        />

        {customerPickOpen && showCustomerDropdown ? (
          <div style={s.suggestions}>
            {customerSuggestions.length === 0 ? (
              <div style={{ padding: 10, color: "#888" }}>No matches — new customer</div>
            ) : (
              customerSuggestions.map((c) => (
                <div
                  key={String(c.id)}
                  style={s.suggestionItem}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSelectedCustomer(c);
                    setCustomerInput(`${c.name ?? "Customer"} (${String(c.phone ?? "")})`);
                    setCustomerPickOpen(false);
                  }}
                >
                  <b>{c.name ?? "Customer"}</b> — {String(c.phone ?? "")}
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>

      {/* SEARCH */}
      <div style={s.customBox}>
        <h3 style={{ marginTop: 0 }}>Search</h3>
        <input
          type="text"
          value={search}
          placeholder={loading ? "Loading..." : "Search products..."}
          style={{ ...s.customerInput, width: "90%" }}
          onChange={(e) => setSearch(e.target.value)}
          disabled={loading || checkingOut}
        />
        {search.trim() ? <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>Showing search results — categories hidden</div> : null}
      </div>

      {/* PRODUCTS */}

      <div style={s.productsContainer}>
        {filteredProducts.map((p) => (
          <div key={p.id} style={s.productCard}>
            <div style={s.productName}>{p.slug}</div>

            {/* Click = show profit % */}
            <div
              style={s.productPrice}
              onClick={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                const mode = el.getAttribute("data-mode") || "price";

                if (mode === "price") {
                  const price = Number(p.price || 0);
                  const cost = Number(p.cost || 0);
                  const margin = price <= 0 ? 0 : ((price - cost) / price) * 100;

                  el.textContent = `${money(price)} | Profit: ${margin.toFixed(1)}%`;
                  el.style.color = margin > 30 ? "green" : margin >= 20 ? "orange" : "red";
                  el.setAttribute("data-mode", "profit");
                } else {
                  el.textContent = money(p.price);
                  el.style.color = "var(--red)";
                  el.setAttribute("data-mode", "price");
                }
              }}
            >
              {money(p.price)}
            </div>

            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
              {p.is_weight ? "Weighted (kg)" : "Unit"} • stock {p.qty}
              {p.subsubcategory_id != null ? ` • ${subsubById[String(p.subsubcategory_id)] ?? ""}` : ""}
            </div>

            <button type="button" style={s.addToCart} onClick={() => addToCartFromProduct(p)} disabled={checkingOut}>
              Add to Cart
            </button>
          </div>
        ))}
      </div>

      {/* <button type="button" style={s.viewSalesBtn} onClick={() => (window.location.href = "/")}>
        View Sales History
      </button> */}

      <button
        type="button"
        style={s.checkoutBtn}
        onClick={() => {
          if (!cart.length) {
            setErrorMsg("Cart is empty!");
            return;
          }
          setCheckoutOpen(true);
        }}
      >
        Checkout ({cart.length})
      </button>

      {/* CHECKOUT MODAL */}
      {checkoutOpen ? (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <h2 style={{ marginTop: 0 }}>Checkout</h2>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <button type="button" style={s.topBtn} onClick={() => setCheckoutMode("paid")}>
                Paid {checkoutMode === "paid" ? "✓" : ""}
              </button>
              <button type="button" style={s.topBtn} onClick={() => setCheckoutMode("credit")}>
                Credit {checkoutMode === "credit" ? "✓" : ""}
              </button>
            </div>

            <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
              Tip: click an item name to edit qty/price/total (bulk deals supported).
            </div>

            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Item</th>
                  <th style={s.th}>Qty</th>
                  <th style={s.th}>Price</th>
                  <th style={s.th}>Total</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((it) => {
                  const rowTotal = Number((it.qty * it.unit_price).toFixed(2));
                  const isEditing = rowEditKey === it.key;

                  return (
                    <tr key={it.key}>
                      <td
                        style={{ ...s.td, cursor: "pointer", textDecoration: isEditing ? "underline" : "none" }}
                        onClick={() => {
                          if (checkingOut) return;
                          if (isEditing) return;
                          beginRowEdit(it);
                        }}
                        title="Click to edit this row"
                      >
                        {it.slug}
                      </td>

                      <td style={s.td}>
                        {isEditing ? (
                          <input
                            type="number"
                            min={0.01}
                            step={it.is_weight ? 0.01 : 1}
                            value={rowDraftQty}
                            style={s.qtyInput}
                            onChange={(e) => {
                              const v = e.target.value;
                              setRowDraftQty(v);

                              const q = Number(v);
                              const up = Number(rowDraftUnitPrice);

                              if (Number.isFinite(q) && q > 0) {
                                const newUnit = Number.isFinite(up) ? up : it.unit_price;

                                setCart((prev) =>
                                  prev.map((row) =>
                                    row.key !== it.key
                                      ? row
                                      : {
                                          ...row,
                                          qty: q,
                                          unit_price: newUnit,
                                        }
                                  )
                                );

                                setRowDraftTotal(String(q * newUnit));
                              }
                            }}
                            disabled={checkingOut}
                          />
                        ) : (
                          <span>{it.qty}</span>
                        )}
                      </td>

                      <td style={s.td}>
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={rowDraftUnitPrice}
                            style={s.priceInput}
                            onChange={(e) => {
                              const v = e.target.value;
                              setRowDraftUnitPrice(v);

                              const q = Number(rowDraftQty);
                              const up = Number(v);

                              if (Number.isFinite(q) && q > 0 && Number.isFinite(up)) {
                                setCart((prev) =>
                                  prev.map((row) =>
                                    row.key !== it.key
                                      ? row
                                      : {
                                          ...row,
                                          qty: q,
                                          unit_price: up,
                                        }
                                  )
                                );

                                setRowDraftTotal(String(q * up));
                              }
                            }}
                            disabled={checkingOut}
                          />
                        ) : (
                          <span>{money(it.unit_price)}</span>
                        )}
                      </td>

                      <td style={s.td}>
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={rowDraftTotal}
                            style={s.priceInput}
                            onChange={(e) => {
                              const v = e.target.value;
                              setRowDraftTotal(v);

                              const q = Number(rowDraftQty);
                              const t = Number(v);

                              if (Number.isFinite(q) && q > 0 && Number.isFinite(t)) {
                                const newUnit = t / q;

                                setCart((prev) =>
                                  prev.map((row) =>
                                    row.key !== it.key
                                      ? row
                                      : {
                                          ...row,
                                          qty: q,
                                          unit_price: newUnit,
                                        }
                                  )
                                );

                                setRowDraftUnitPrice(String(newUnit));
                              }
                            }}
                            disabled={checkingOut}
                          />
                        ) : (
                          <span>{money(rowTotal)}</span>
                        )}
                      </td>

                      <td style={s.td}>
                        <button
                          type="button"
                          style={s.removeBtn}
                          onClick={() => removeCartItem(it.key)}
                          disabled={checkingOut}
                        >
                          ✖
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ textAlign: "right", marginBottom: 15 }}>
              <b>Total: {money(cartTotals.revenue)}</b>
            </div>

            <button
              type="button"
              style={{ ...s.confirmBtn, opacity: checkingOut ? 0.6 : 1 }}
              onClick={checkoutPOS}
              disabled={checkingOut}
            >
              {checkingOut ? "Processing..." : "Confirm Sale"}
            </button>

            <button type="button" style={s.cancelBtn} onClick={() => setCheckoutOpen(false)} disabled={checkingOut}>
              Close
            </button>

            <button
              type="button"
              style={{ ...s.cancelBtn, background: "#ffe4e6", color: "#b42318", fontWeight: "bold" }}
              onClick={clearCartAndPersisted}
              disabled={checkingOut}
            >
              Clear Cart
            </button>
          </div>
        </div>
      ) : null}

      {/* Responsive tweaks */}
      <style jsx global>{`
        @media (max-width: 600px) {
          .products-container {
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 10px;
          }
        }
      `}</style>
    </main>
  );
}