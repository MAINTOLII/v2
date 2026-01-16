

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Expense = {
  id: string;
  created_at: string;
  expense_date: string;
  amount: number;
  currency: string;
  category: string | null;
  payment_method: string | null;
  vendor: string | null;
  note: string | null;
  created_by: string | null;
};

const CURRENCIES = ["USD", "SOS"] as const;
const CATEGORIES = [
  "Rent",
  "Utilities",
  "Salaries",
  "Stock / Inventory",
  "Transport",
  "Marketing",
  "Repairs",
  "Packaging",
  "Other",
] as const;

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function money(n: number, currency: string) {
  const v = Number.isFinite(n) ? n : 0;
  return `${currency} ${v.toFixed(2)}`;
}

export default function Expenses() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [fromDate, setFromDate] = useState<string>(() => {
    // default: first day of month
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}-01`;
  });
  const [toDate, setToDate] = useState<string>(() => todayISO());
  const [currencyFilter, setCurrencyFilter] = useState<string>("USD");

  // Form
  const [expense_date, setExpenseDate] = useState<string>(() => todayISO());
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<string>("USD");
  const [category, setCategory] = useState<string>("Other");
  const [payment_method, setPaymentMethod] = useState<string>("Cash");
  const [vendor, setVendor] = useState<string>("");
  const [note, setNote] = useState<string>("");

  async function load() {
    setLoading(true);
    setErrorMsg(null);

    const q = supabase
      .from("expenses")
      .select("id,created_at,expense_date,amount,currency,category,payment_method,vendor,note,created_by")
      .gte("expense_date", fromDate)
      .lte("expense_date", toDate)
      .eq("currency", currencyFilter)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    const { data, error } = await q;

    if (error) {
      setErrorMsg(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as Expense[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, currencyFilter]);

  const totals = useMemo(() => {
    const total = rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
    return {
      total,
      count: rows.length,
    };
  }, [rows]);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErrorMsg("Enter a valid amount > 0");
      return;
    }

    setSaving(true);

    const payload = {
      expense_date,
      amount: amt,
      currency,
      category: category || null,
      payment_method: payment_method || null,
      vendor: vendor.trim().length ? vendor.trim() : null,
      note: note.trim().length ? note.trim() : null,
    };

    const { error } = await supabase.from("expenses").insert(payload);

    if (error) {
      setSaving(false);
      setErrorMsg(error.message);
      return;
    }

    // reset small fields but keep date/currency for speed
    setAmount("");
    setVendor("");
    setNote("");
    setSaving(false);

    // reload to include server timestamp + created_by
    await load();
  }

  async function deleteExpense(id: string) {
    if (!confirm("Delete this expense?")) return;
    setErrorMsg(null);

    // optimistic
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== id));

    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      setRows(prev);
      setErrorMsg(error.message);
    }
  }

  return (
    <div className="w-full">
      {/* Component header (smaller, no page chrome) */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-base font-extrabold">Expenses</div>
        {loading ? <div className="text-xs text-gray-500">Loading…</div> : null}
      </div>

      {/* Add expense */}
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="font-extrabold">Add expense</div>
          {saving ? <div className="text-xs text-gray-500">Saving…</div> : null}
        </div>

        <form onSubmit={addExpense} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <div className="mb-1 font-semibold">Date</div>
            <input
              type="date"
              value={expense_date}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2"
              required
            />
          </label>

          <label className="text-sm">
            <div className="mb-1 font-semibold">Amount</div>
            <input
              inputMode="decimal"
              placeholder="e.g. 12.50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2"
              required
            />
          </label>

          <label className="text-sm">
            <div className="mb-1 font-semibold">Currency</div>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2">
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <div className="mb-1 font-semibold">Category</div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <div className="mb-1 font-semibold">Payment method</div>
            <input
              placeholder="Cash / EVC / Bank / Card"
              value={payment_method}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <div className="mb-1 font-semibold">Vendor (optional)</div>
            <input value={vendor} onChange={(e) => setVendor(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="Who did you pay?" />
          </label>

          <label className="text-sm sm:col-span-2">
            <div className="mb-1 font-semibold">Note (optional)</div>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="Reason / details" />
          </label>

          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setAmount("");
                setVendor("");
                setNote("");
                setCategory("Other");
                setPaymentMethod("Cash");
              }}
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-extrabold"
            >
              Clear
            </button>
          </div>
        </form>

        {errorMsg ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMsg}</div> : null}
      </div>

      {/* Filters + summary */}
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <div className="mb-1 font-semibold">From</div>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2" />
            </label>
            <label className="text-sm">
              <div className="mb-1 font-semibold">To</div>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2" />
            </label>
            <label className="text-sm">
              <div className="mb-1 font-semibold">Currency</div>
              <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2">
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-2xl bg-gray-50 px-4 py-3">
            <div className="text-xs text-gray-600">Total</div>
            <div className="text-lg font-extrabold">{money(totals.total, currencyFilter)}</div>
            <div className="text-xs text-gray-600">{totals.count} expense(s)</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="font-extrabold">Expense list</div>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No expenses in this range.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap font-semibold">{r.expense_date}</td>
                    <td className="px-4 py-3">{r.category ?? "—"}</td>
                    <td className="px-4 py-3">{r.vendor ?? "—"}</td>
                    <td className="px-4 py-3">{r.payment_method ?? "—"}</td>
                    <td className="px-4 py-3 max-w-[360px] truncate" title={r.note ?? ""}>
                      {r.note ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold">{money(Number(r.amount ?? 0), r.currency)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => deleteExpense(r.id)}
                        className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-extrabold text-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}