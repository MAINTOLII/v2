// app/components/CreditsManager.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type CreditRow = {
  id: string;
  customer_id: number | null;
  customer_phone: number | null;
  order_id: string | null;
  amount: number | null; // debit (what they took)
  status: string | null; // ignored for ledger
  created_at?: string | null;
  paid_at?: string | null;
};

type Customer = {
  id: number;
  name: string | null;
  phone: number | null;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_slug: string;
  qty: number;
  unit_price: number;
  line_total: number;
  is_weight: boolean;
};

type CreditPayment = {
  id: string;
  credit_id: string;
  amount: number;
  created_at: string;
};

type LedgerLine =
  | { kind: "debit"; id: string; created_at: string; amount: number; order_id: string | null }
  | { kind: "payment"; id: string; created_at: string; amount: number };

const s: Record<string, React.CSSProperties> = {
  page: { padding: 12, background: "#fafafa", minHeight: "100vh", fontFamily: "system-ui" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },

  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  rowBetween: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" },

  input: { height: 38, padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" },
  select: { height: 38, padding: "8px 10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" },

  btnGhost: {
    height: 38,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111",
    fontWeight: 700,
    cursor: "pointer",
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#fff",
    fontSize: 12,
    fontWeight: 600,
  },

  amountRed: { color: "#b42318", fontWeight: 700 },
  amountGreen: { color: "#067647", fontWeight: 700 },

  cardBtn: {
    width: "100%",
    textAlign: "left",
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 12,
    padding: 12,
    cursor: "pointer",
  },

  muted: { fontSize: 12, opacity: 0.7 },
  small: { fontSize: 12, opacity: 0.75 },

  err: { color: "#b42318", fontWeight: 700 },
  ok: { color: "#067647", fontWeight: 700 },

  ledgerBox: { border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" },
  ledgerRow: {
    display: "grid",
    gridTemplateColumns: "120px 1fr 110px",
    gap: 10,
    padding: "10px 12px",
    alignItems: "start",
    borderTop: "1px solid #f1f5f9",
  },
  ledgerHead: {
    display: "grid",
    gridTemplateColumns: "120px 1fr 110px",
    gap: 10,
    padding: "10px 12px",
    alignItems: "center",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    opacity: 0.85,
  },

  inputSm: {
    height: 34,
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    fontSize: 14,
  },
  btnSm: {
    height: 34,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },

  itemsWrap: { display: "grid", gap: 6 },
  itemLine: { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 },
};

function money(n: number) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function fmt(dt?: string | null) {
  if (!dt) return "";
  try {
    const d = new Date(dt);
    // if it's midnight, show date only (avoids ugly 0:00)
    const hh = d.getHours();
    const mm = d.getMinutes();
    const ss = d.getSeconds();
    const ds = d.toLocaleDateString();
    if (hh === 0 && mm === 0 && ss === 0) return ds;
    return `${ds} ${d.toLocaleTimeString()}`;
  } catch {
    return dt ?? "";
  }
}

function normalizePhone(input: string) {
  return input.replace(/\s+/g, "").trim();
}

function isDigitsOnly(v: string) {
  return /^\d+$/.test(v);
}

export default function CreditsManager() {
  const [credits, setCredits] = useState<CreditRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [tab, setTab] = useState<"open" | "paid" | "all">("open");
  const [q, setQ] = useState("");

  const [expandedKey, setExpandedKey] = useState<string>("");

  const [itemsByOrderId, setItemsByOrderId] = useState<Record<string, OrderItem[]>>({});
  const [paymentsByCreditId, setPaymentsByCreditId] = useState<Record<string, CreditPayment[]>>({});
  const [loadingItems, setLoadingItems] = useState(false);

  // One payment box per customer
  const [payCustomerByKey, setPayCustomerByKey] = useState<Record<string, string>>({});

  // One name draft per customer (for editing name inline)
  const [nameDraftByCustomerId, setNameDraftByCustomerId] = useState<Record<string, string>>({});
  const [editingCustomerId, setEditingCustomerId] = useState<string>("");
  async function saveCustomerName(customer: Customer, rawName: string) {
    setErr("");
    setOk("");

    const name = rawName.trim();
    if (name.length < 2) {
      setErr("Name must be at least 2 characters.");
      return;
    }

    const { data, error } = await supabase
      .from("customers")
      .update({ name })
      .eq("id", customer.id)
      .select("id,name,phone")
      .single();

    if (error) {
      setErr(error.message);
      return;
    }

    const updated = data as any as Customer;

    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setNameDraftByCustomerId((prev) => {
      const next = { ...prev };
      delete next[String(updated.id)];
      return next;
    });

    setOk("Customer name saved.");
  }

  // Add credit picker
  const [addQuery, setAddQuery] = useState<string>("");
  const [addSelected, setAddSelected] = useState<Customer | null>(null);
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [manualAmount, setManualAmount] = useState<string>("");

  const byCustomerId = useMemo(() => {
    const m: Record<string, Customer> = {};
    for (const c of customers) m[String(c.id)] = c;
    return m;
  }, [customers]);

  function customerKey(cr: CreditRow) {
    if (cr.customer_id != null) return `cid:${cr.customer_id}`;
    if (cr.customer_phone != null) return `phone:${cr.customer_phone}`;
    return `unknown:${cr.id}`;
  }

  function nameMeta(cust?: Customer | null) {
    const nm = String(cust?.name ?? "").trim();
    const isPlaceholder = nm.length === 0 || nm.toLowerCase() === "customer";
    return { nm, isPlaceholder, display: isPlaceholder ? "Customer" : nm };
  }

  const addSuggestions = useMemo(() => {
    const q0 = addQuery.trim();
    if (!q0) return [] as Customer[];

    const norm = q0.toLowerCase();
    const digits = normalizePhone(q0);
    const digitMode = isDigitsOnly(digits);

    // name >=2, phone >=3
    if (digitMode) {
      if (digits.length < 3) return [];
    } else {
      if (norm.length < 2) return [];
    }

    return customers
      .filter((c) => {
        const name = (c.name ?? "").toLowerCase();
        const phone = c.phone != null ? String(c.phone) : "";
        return digitMode ? phone.includes(digits) : name.includes(norm);
      })
      .slice(0, 8);
  }, [addQuery, customers]);

  async function ensureCustomer(phoneText: string) {
    const norm = normalizePhone(phoneText);
    const phoneNum = Number(norm);
    if (!Number.isFinite(phoneNum)) throw new Error("Invalid phone");

    const local = customers.find((c) => Number(c.phone) === phoneNum);
    if (local) return local;

    const { data: found, error: findErr } = await supabase
      .from("customers")
      .select("id,name,phone")
      .eq("phone", phoneNum)
      .maybeSingle();

    if (!findErr && found) {
      const c = found as any as Customer;
      setCustomers((prev) => (prev.some((x) => x.id === c.id) ? prev : [c, ...prev]));
      return c;
    }

    const { data, error } = await supabase
      .from("customers")
      .insert({ phone: phoneNum })
      .select("id,name,phone")
      .single();

    if (error) throw error;

    const created = data as any as Customer;
    setCustomers((prev) => [created, ...prev]);
    return created;
  }

  async function linkCustomerFromPhoneForGroup(phoneNum: number, groupKey: string) {
    // Ensure there is a customers row for this phone
    const cust = await ensureCustomer(String(phoneNum));

    // Update credits in DB: any credit rows with this phone and missing customer_id
    const { error } = await supabase
      .from("credits")
      .update({ customer_id: cust.id })
      .eq("customer_phone", phoneNum)
      .is("customer_id", null);

    if (error) throw error;

    // Update local state so UI instantly has customer_id
    setCredits((prev) =>
      prev.map((cr) => {
        if (Number(cr.customer_phone ?? 0) === Number(phoneNum) && (cr.customer_id == null || cr.customer_id === 0)) {
          return { ...cr, customer_id: cust.id };
        }
        return cr;
      })
    );

    // Expand this group so name edit UI is visible
    if (expandedKey !== groupKey) {
      // We can't reliably access group orderIds/creditIds here; caller will expand.
      setExpandedKey(groupKey);
    }

    return cust;
  }

  // --- data loaders ---

  async function fetchOrderItems(orderIds: string[]) {
    const missing = orderIds.filter((id) => !itemsByOrderId[id]);
    if (missing.length === 0) return;

    setLoadingItems(true);
    const { data, error } = await supabase
      .from("order_items")
      .select("id,order_id,product_slug,qty,unit_price,line_total,is_weight")
      .in("order_id", missing);

    if (!error) {
      const rows = (data ?? []) as any as OrderItem[];
      const next = { ...itemsByOrderId };
      for (const r of rows) {
        if (!next[r.order_id]) next[r.order_id] = [];
        next[r.order_id].push(r);
      }
      setItemsByOrderId(next);
    }
    setLoadingItems(false);
  }

  async function fetchAllCreditPayments(creditIds: string[]) {
    const uniq = Array.from(new Set(creditIds)).filter(Boolean);
    if (uniq.length === 0) return;

    // Batch to avoid URL length limits
    const batchSize = 500;
    const next: Record<string, CreditPayment[]> = {};
    for (const cid of uniq) next[cid] = [];

    for (let i = 0; i < uniq.length; i += batchSize) {
      const batch = uniq.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from("credit_payments")
        .select("id,credit_id,amount,created_at")
        .in("credit_id", batch)
        .order("created_at", { ascending: true });

      if (error) continue;

      const rows = (data ?? []) as any as CreditPayment[];
      for (const r of rows) {
        if (!next[r.credit_id]) next[r.credit_id] = [];
        next[r.credit_id].push(r);
      }
    }

    setPaymentsByCreditId(next);
  }

  async function fetchCreditPayments(creditIds: string[]) {
    const missing = creditIds.filter((id) => !paymentsByCreditId[id]);
    if (missing.length === 0) return;

    const { data, error } = await supabase
      .from("credit_payments")
      .select("id,credit_id,amount,created_at")
      .in("credit_id", missing)
      .order("created_at", { ascending: true });

    if (error) return;

    const rows = (data ?? []) as any as CreditPayment[];
    setPaymentsByCreditId((prev) => {
      const next = { ...prev };
      for (const cid of missing) next[cid] = [];
      for (const r of rows) {
        if (!next[r.credit_id]) next[r.credit_id] = [];
        next[r.credit_id].push(r);
      }
      return next;
    });
  }

  async function load() {
    setLoading(true);
    setErr("");
    setOk("");

    const [cRes, custRes] = await Promise.all([
      supabase.from("credits").select("*").order("created_at", { ascending: false }).limit(5000),
      supabase.from("customers").select("id,name,phone").order("id", { ascending: false }).limit(5000),
    ]);

    if (cRes.error) {
      setErr(cRes.error.message);
      setLoading(false);
      return;
    }

    if (!custRes.error) setCustomers((custRes.data ?? []) as any);

    const creditRows = (cRes.data ?? []) as any as CreditRow[];
    setCredits(creditRows);

    // preload ALL payments so Paid/Open tabs correct immediately
    await fetchAllCreditPayments(creditRows.map((x) => x.id));

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter credits by search
  const filteredCredits = useMemo(() => {
    const query = q.trim().toLowerCase();
    return credits.filter((cr) => {
      if (!query) return true;
      const cust = cr.customer_id != null ? byCustomerId[String(cr.customer_id)] : null;
      const phone = String(cr.customer_phone ?? cust?.phone ?? "");
      const name = (cust?.name ?? "").toLowerCase();
      return phone.includes(query) || name.includes(query);
    });
  }, [credits, q, byCustomerId]);

  // Group by customer
  const groups = useMemo(() => {
    const m: Record<
      string,
      { key: string; title: string; credits: CreditRow[]; creditIds: string[]; orderIds: string[] }
    > = {};

    for (const cr of filteredCredits) {
      const key = customerKey(cr);
      const cust = cr.customer_id != null ? byCustomerId[String(cr.customer_id)] : null;
      const phone = cr.customer_phone ?? cust?.phone ?? null;
      const meta = nameMeta(cust);
      const title = `${meta.display} • ${phone ?? ""}`.trim();

      if (!m[key]) m[key] = { key, title, credits: [], creditIds: [], orderIds: [] };

      m[key].credits.push(cr);
      m[key].creditIds.push(cr.id);
      if (cr.order_id) m[key].orderIds.push(cr.order_id);
    }

    const arr = Object.values(m);

    for (const g of arr) {
      g.creditIds = Array.from(new Set(g.creditIds));
      g.orderIds = Array.from(new Set(g.orderIds));

      // latest first
      g.credits.sort((a, b) => {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bt - at;
      });
    }

    // sort customers by latest credit
    arr.sort((a, b) => {
      const at = a.credits[0]?.created_at ? new Date(a.credits[0].created_at).getTime() : 0;
      const bt = b.credits[0]?.created_at ? new Date(b.credits[0].created_at).getTime() : 0;
      return bt - at;
    });

    return arr;
  }, [filteredCredits, byCustomerId]);

  // Totals per customer (ledger style)
  const customerTotalsByKey = useMemo(() => {
    const out: Record<string, { taken: number; paid: number; balance: number }> = {};

    for (const g of groups) {
      const taken = g.credits.reduce((s0, c) => s0 + Number(c.amount ?? 0), 0);
      const paid = g.creditIds.reduce((s0, cid) => {
        const pays = paymentsByCreditId[cid] ?? [];
        return s0 + pays.reduce((p0, p) => p0 + Number(p.amount ?? 0), 0);
      }, 0);
      const balance = Number((taken - paid).toFixed(2));
      out[g.key] = { taken, paid, balance };
    }

    return out;
  }, [groups, paymentsByCreditId]);

  const topTotals = useMemo(() => {
    let openTotal = 0;
    let paidTotal = 0;

    for (const g of groups) {
      const t = customerTotalsByKey[g.key];
      if (!t) continue;
      if (t.balance > 0) openTotal += t.balance;
      paidTotal += t.paid;
    }

    return { openTotal: Number(openTotal.toFixed(2)), paidTotal: Number(paidTotal.toFixed(2)) };
  }, [groups, customerTotalsByKey]);

  const visibleGroups = useMemo(() => {
    if (tab === "all") return groups;
    if (tab === "open") return groups.filter((g) => (customerTotalsByKey[g.key]?.balance ?? 0) > 0.0001);
    return groups.filter((g) => (customerTotalsByKey[g.key]?.balance ?? 0) <= 0.0001);
  }, [groups, tab, customerTotalsByKey]);

  async function toggleExpand(key: string, orderIds: string[], creditIds: string[]) {
    if (expandedKey === key) {
      setExpandedKey("");
      return;
    }
    setExpandedKey(key);
    await Promise.all([fetchOrderItems(orderIds), fetchCreditPayments(creditIds)]);
  }

  // Ledger: payment inserts ONLY a payment row, does NOT modify credits/products.
  async function applyCustomerPayment(groupKey: string, group: (typeof groups)[number]) {
    setErr("");
    setOk("");

    const raw = (payCustomerByKey[groupKey] ?? "").trim();
    const amt = Number(raw);

    if (!Number.isFinite(amt) || amt <= 0) {
      setErr("Enter a valid payment amount.");
      return;
    }

    // Ensure we have payments for this customer to compute balance accurately
    await fetchCreditPayments(group.creditIds);

    const totals = customerTotalsByKey[groupKey];
    const balance = Number(totals?.balance ?? 0);

    if (balance <= 0) {
      setErr("No outstanding balance.");
      return;
    }
    if (amt > balance) {
      setErr("Payment is more than remaining balance.");
      return;
    }

    // Link payment to oldest credit just for grouping
    const oldest = group.credits
      .slice()
      .sort((a, b) => {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return at - bt;
      })[0];

    if (!oldest) {
      setErr("No credit entries for this customer.");
      return;
    }

    const nowIso = new Date().toISOString();

    const { data: inserted, error } = await supabase
      .from("credit_payments")
      .insert({
        credit_id: oldest.id,
        amount: Number(amt.toFixed(2)),
        created_at: nowIso,
      } as any)
      .select("id,credit_id,amount,created_at")
      .single();

    if (error) {
      setErr(error.message);
      return;
    }

    const row = inserted as any as CreditPayment;

    // ✅ optimistic append so totals update instantly
    setPaymentsByCreditId((prev) => {
      const next = { ...prev };
      const arr = (next[oldest.id] ?? []).slice();
      arr.push(row);
      arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      next[oldest.id] = arr;
      return next;
    });

    setPayCustomerByKey((prev) => ({ ...prev, [groupKey]: "" }));
    setOk("Payment saved.");
  }

  async function addManualCredit() {
    setErr("");
    setOk("");

    const amount = Number(manualAmount.trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      setErr("Amount must be > 0.");
      return;
    }

    let cust: Customer;
    try {
      if (addSelected) {
        cust = addSelected;
        if (cust.phone == null) {
          setErr("Selected customer has no phone.");
          return;
        }
      } else {
        const raw = addQuery.trim();
        const phoneOrText = normalizePhone(raw);
        if (!phoneOrText) {
          setErr("Enter customer name or phone.");
          return;
        }
        if (!isDigitsOnly(phoneOrText)) {
          setErr("Select a customer from dropdown, or type a phone number to create new.");
          return;
        }
        cust = await ensureCustomer(phoneOrText);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Invalid customer");
      return;
    }

    const phoneNum = Number(cust.phone);

    const { data: inserted, error } = await supabase
      .from("credits")
      .insert({
        customer_id: cust.id,
        customer_phone: phoneNum,
        order_id: null,
        amount: Number(amount.toFixed(2)),
        status: "open",
      } as any)
      .select("*")
      .single();

    if (error) {
      setErr(error.message);
      return;
    }

    const row = inserted as any as CreditRow;

    // ✅ optimistic prepend
    setCredits((prev) => [row, ...prev]);
    setPaymentsByCreditId((prev) => ({ ...prev, [row.id]: prev[row.id] ?? [] }));

    setOk("Credit added.");
    setManualAmount("");
    setAddQuery("");
    setAddSelected(null);
    setAddOpen(false);
  }

  function buildLedgerLinesForGroup(g: (typeof groups)[number]): LedgerLine[] {
    const debits: LedgerLine[] = g.credits
      .map((c) => ({
        kind: "debit" as const,
        id: c.id,
        created_at: c.created_at ?? "",
        amount: Number(c.amount ?? 0),
        order_id: c.order_id,
      }))
      .filter((x) => x.amount > 0.0001);

    const payments: LedgerLine[] = g.creditIds
      .flatMap((cid) => paymentsByCreditId[cid] ?? [])
      .map((p) => ({
        kind: "payment" as const,
        id: p.id,
        created_at: p.created_at,
        amount: Number(p.amount ?? 0),
      }))
      .filter((x) => x.amount > 0.0001);

    const all = [...debits, ...payments];
    all.sort((a, b) => {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bt - at;
    });

    return all;
  }

  return (
    <main style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Credits (Ledger)</h1>

        <div style={s.row}>
          <span style={s.badge}>Open {money(topTotals.openTotal)}</span>
          <span style={s.badge}>Paid {money(topTotals.paidTotal)}</span>
          <button style={s.btnGhost} onClick={load} type="button">
            Refresh
          </button>
        </div>
      </div>

      <div style={{ height: 10 }} />

      {(err || ok) && (
        <div style={{ ...s.card, borderColor: err ? "#f1c4c4" : "#c7f0d1" }}>
          {err ? <div style={s.err}>{err}</div> : null}
          {ok ? <div style={s.ok}>{ok}</div> : null}
        </div>
      )}

      <div style={{ height: 10 }} />

      <div style={s.card}>
        <div style={s.row}>
          <select style={s.select} value={tab} onChange={(e) => setTab(e.target.value as any)}>
            <option value="open">Open</option>
            <option value="paid">Paid</option>
            <option value="all">All</option>
          </select>

          <input
            style={{ ...s.input, flex: 1, minWidth: 240 }}
            placeholder="Search phone or name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div style={{ height: 10 }} />

      {/* Add credit */}
      <div style={s.card}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Add credit</div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...s.input, width: "100%" }}
                placeholder="Customer name or phone"
                value={addSelected ? `${addSelected.name ?? "Customer"} • ${addSelected.phone ?? ""}` : addQuery}
                onChange={(e) => {
                  setAddSelected(null);
                  setAddQuery(e.target.value);
                  setAddOpen(true);
                }}
                onFocus={() => setAddOpen(true)}
                onBlur={() => setTimeout(() => setAddOpen(false), 120)}
              />

              {addOpen && addSuggestions.length > 0 && !addSelected ? (
                <div
                  style={{
                    position: "absolute",
                    zIndex: 50,
                    top: "calc(100% + 6px)",
                    left: 0,
                    right: 0,
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    overflow: "hidden",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                  }}
                >
                  {addSuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setAddSelected(c);
                        setAddOpen(false);
                        setAddQuery("");
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        border: "none",
                        background: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{c.name ?? "Customer"}</span>
                      <span style={s.muted}>{c.phone ?? ""}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div style={s.row}>
              <input
                style={{ ...s.input, width: 160 }}
                placeholder="Amount"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
              />

              <button type="button" style={s.btnGhost} onClick={addManualCredit}>
                Add
              </button>

              {addSelected ? (
                <button
                  type="button"
                  style={s.btnGhost}
                  onClick={() => {
                    setAddSelected(null);
                    setAddQuery("");
                    setAddOpen(false);
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div style={s.muted}>Tip: name (2+ letters) or phone (3+ digits)</div>
          </div>
        </div>
      </div>

      <div style={{ height: 10 }} />

      <div style={s.card}>
        {loading ? (
          <div style={{ opacity: 0.75 }}>Loading…</div>
        ) : visibleGroups.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No credits found.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {visibleGroups.map((g) => {
              const totals = customerTotalsByKey[g.key] ?? { taken: 0, paid: 0, balance: 0 };
              const isSettled = totals.balance <= 0.0001;

              return (
                <div key={g.key}>
                  <div
                    role="button"
                    tabIndex={0}
                    style={s.cardBtn}
                    onClick={() => toggleExpand(g.key, g.orderIds, g.creditIds)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleExpand(g.key, g.orderIds, g.creditIds);
                      }
                    }}
                  >
                    <div style={s.rowBetween}>
                      <div style={{ display: "grid", gap: 2 }}>
                        {(() => {
                          const anyCr = g.credits[0];
                          const cust = anyCr?.customer_id != null ? byCustomerId[String(anyCr.customer_id)] : null;
                          const phone = anyCr?.customer_phone ?? cust?.phone ?? null;

                          if (!cust) {
                            const phoneNum = Number(phone ?? 0);
                            const canLink = Number.isFinite(phoneNum) && phoneNum > 0;

                            return (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 800 }}>Customer</span>
                                <button
                                  type="button"
                                  disabled={!canLink}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!canLink) return;
                                    try {
                                      const linked = await linkCustomerFromPhoneForGroup(phoneNum, g.key);
                                      const cidKey = String(linked.id);
                                      setEditingCustomerId(cidKey);
                                      setNameDraftByCustomerId((p) => ({ ...p, [cidKey]: "" }));
                                      if (expandedKey !== g.key) {
                                        await toggleExpand(g.key, g.orderIds, g.creditIds);
                                      }
                                    } catch (errAny: any) {
                                      setErr(errAny?.message ?? "Failed to link customer");
                                    }
                                  }}
                                  style={{
                                    height: 28,
                                    width: 28,
                                    borderRadius: 8,
                                    border: "1px solid #e5e7eb",
                                    background: "#fff",
                                    cursor: canLink ? "pointer" : "not-allowed",
                                    lineHeight: "26px",
                                    textAlign: "center",
                                    padding: 0,
                                    opacity: canLink ? 1 : 0.5,
                                  }}
                                  title={canLink ? "Add name" : "No phone"}
                                >
                                  ✏️
                                </button>
                                <span style={s.muted}>• {phone ?? ""}</span>
                              </div>
                            );
                          }

                          const meta = nameMeta(cust);

                          return (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 800 }}>{meta.display}</span>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const cidKey = String(cust.id);
                                  setEditingCustomerId(cidKey);
                                  setNameDraftByCustomerId((p) => ({ ...p, [cidKey]: meta.isPlaceholder ? "" : meta.nm }));
                                  if (expandedKey !== g.key) {
                                    await toggleExpand(g.key, g.orderIds, g.creditIds);
                                  }
                                }}
                                style={{
                                  height: 28,
                                  width: 28,
                                  borderRadius: 8,
                                  border: "1px solid #e5e7eb",
                                  background: "#fff",
                                  cursor: "pointer",
                                  lineHeight: "26px",
                                  textAlign: "center",
                                  padding: 0,
                                }}
                                title={meta.isPlaceholder ? "Add name" : "Edit name"}
                              >
                                ✏️
                              </button>
                              <span style={s.muted}>• {phone ?? ""}</span>
                            </div>
                          );
                        })()}
                        <div style={s.muted}>
                          taken {money(totals.taken)} • paid {money(totals.paid)}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "baseline",
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        <span style={isSettled ? s.amountGreen : s.amountRed}>{money(Math.max(totals.balance, 0))}</span>
                        <span style={{ ...s.badge, borderColor: isSettled ? "#c7f0d1" : "#f1c4c4" }}>
                          {isSettled ? "PAID" : "OPEN"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {expandedKey === g.key ? (
                    <div style={{ ...s.card, marginTop: 8 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                        {(() => {
                          const anyCr = g.credits[0];
                          const cust = anyCr?.customer_id != null ? byCustomerId[String(anyCr.customer_id)] : null;
                          if (!cust) {
                            const phoneNum = Number(anyCr?.customer_phone ?? 0);
                            const canLink = Number.isFinite(phoneNum) && phoneNum > 0;

                            return (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontWeight: 800 }}>Customer</span>
                                <button
                                  type="button"
                                  disabled={!canLink}
                                  style={{
                                    height: 28,
                                    width: 28,
                                    borderRadius: 8,
                                    border: "1px solid #e5e7eb",
                                    background: "#fff",
                                    cursor: canLink ? "pointer" : "not-allowed",
                                    lineHeight: "26px",
                                    textAlign: "center",
                                    padding: 0,
                                    opacity: canLink ? 1 : 0.5,
                                  }}
                                  title={canLink ? "Add name" : "No phone"}
                                  onClick={async () => {
                                    if (!canLink) return;
                                    try {
                                      const linked = await linkCustomerFromPhoneForGroup(phoneNum, g.key);
                                      const cidKey = String(linked.id);
                                      setEditingCustomerId(cidKey);
                                      setNameDraftByCustomerId((p) => ({ ...p, [cidKey]: "" }));
                                    } catch (errAny: any) {
                                      setErr(errAny?.message ?? "Failed to link customer");
                                    }
                                  }}
                                >
                                  ✏️
                                </button>
                              </div>
                            );
                          }

                          const cidKey = String(cust.id);
                          const meta = nameMeta(cust);
                          const nm = meta.nm;
                          const missingName = meta.isPlaceholder;

                          const isEditing = editingCustomerId === cidKey;
                          const draft = nameDraftByCustomerId[cidKey] ?? "";

                          if (!isEditing) {
                            return (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontWeight: 800 }}>{meta.display}</span>
                                <button
                                  type="button"
                                  style={{
                                    height: 28,
                                    width: 28,
                                    borderRadius: 8,
                                    border: "1px solid #e5e7eb",
                                    background: "#fff",
                                    cursor: "pointer",
                                    lineHeight: "26px",
                                    textAlign: "center",
                                    padding: 0,
                                  }}
                                  title={missingName ? "Add name" : "Edit name"}
                                  onClick={() => {
                                    setEditingCustomerId(cidKey);
                                    setNameDraftByCustomerId((p) => ({ ...p, [cidKey]: missingName ? "" : meta.nm }));
                                  }}
                                >
                                  ✏️
                                </button>
                              </div>
                            );
                          }

                          return (
                            <>
                              <input
                                style={{ ...s.inputSm, width: 180 }}
                                placeholder={missingName ? "Add name" : "Edit name"}
                                value={draft}
                                onChange={(e) => setNameDraftByCustomerId((p) => ({ ...p, [cidKey]: e.target.value }))}
                              />
                              <button
                                style={s.btnSm}
                                type="button"
                                onClick={async () => {
                                  await saveCustomerName(cust, draft);
                                  setEditingCustomerId("");
                                }}
                                title="Save customer name"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                style={{
                                  ...s.btnSm,
                                  background: "#fff",
                                  color: "#111",
                                  borderColor: "#e5e7eb",
                                }}
                                onClick={() => {
                                  setEditingCustomerId("");
                                  setNameDraftByCustomerId((p) => {
                                    const next = { ...p };
                                    delete next[cidKey];
                                    return next;
                                  });
                                }}
                                title="Cancel"
                              >
                                Cancel
                              </button>
                            </>
                          );
                        })()}
                        <input
                          style={{ ...s.inputSm, width: 160 }}
                          placeholder="Payment"
                          value={payCustomerByKey[g.key] ?? ""}
                          onChange={(e) => setPayCustomerByKey((p) => ({ ...p, [g.key]: e.target.value }))}
                        />
                        <button style={s.btnSm} type="button" onClick={() => applyCustomerPayment(g.key, g)}>
                          Save payment
                        </button>
                        <span style={s.badge}>Remaining {money(Math.max(totals.balance, 0))}</span>
                      </div>

                      {loadingItems ? <div style={{ opacity: 0.75 }}>Loading…</div> : null}

                      <div style={s.ledgerBox}>
                        <div style={s.ledgerHead}>
                          <div>Date</div>
                          <div>Details</div>
                          <div style={{ textAlign: "right" }}>Amount</div>
                        </div>

                        {buildLedgerLinesForGroup(g).map((line, idx) => {
                          const isFirst = idx === 0;
                          const rowStyle = {
                            ...s.ledgerRow,
                            borderTop: isFirst ? "none" : (s.ledgerRow.borderTop as any),
                          } as React.CSSProperties;

                          if (line.kind === "payment") {
                            return (
                              <div key={`pay-${line.id}`} style={rowStyle}>
                                <div style={s.small}>{fmt(line.created_at)}</div>
                                <div style={{ fontWeight: 700, color: "#067647" }}>Payment</div>
                                <div style={{ textAlign: "right", ...s.amountGreen }}>{money(line.amount)}</div>
                              </div>
                            );
                          }

                          const items = line.order_id ? itemsByOrderId[line.order_id] ?? [] : [];

                          return (
                            <div key={`debit-${line.id}`} style={rowStyle}>
                              <div style={s.small}>{fmt(line.created_at)}</div>
                              <div style={s.itemsWrap}>
                                {line.order_id ? (
                                  items.length > 0 ? (
                                    items.map((it) => (
                                      <div key={it.id} style={s.itemLine}>
                                        <span style={{ fontWeight: 700, color: "#b42318" }}>{it.product_slug}</span>
                                        <span style={s.small}>
                                          {it.qty}
                                          {it.is_weight ? " kg" : ""}
                                        </span>
                                      </div>
                                    ))
                                  ) : (
                                    <div style={s.muted}>Order (items loading…)</div>
                                  )
                                ) : (
                                  <div style={{ fontWeight: 700, color: "#b42318" }}>Manual credit</div>
                                )}
                              </div>
                              <div style={{ textAlign: "right", ...s.amountRed }}>{money(line.amount)}</div>
                            </div>
                          );
                        })}

                        {buildLedgerLinesForGroup(g).length === 0 ? (
                          <div style={{ padding: 12, opacity: 0.75 }}>No ledger entries.</div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}