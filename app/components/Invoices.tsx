"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Invoice = {
  id: string;
  invoice_date: string;
  total_amount: number;
  comments: string | null;
  created_at: string;
};

type InvoiceItem = {
  id: string;
  invoice_id: string;
  product_id: string;
  qty: number;
  unit_cost: number;
  line_total: number;
  products?: {
    slug: string;
  } | null;
};

function money(n: number) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return d;
  }
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: 16, maxWidth: 800, margin: "0 auto" },
  header: { fontSize: 20, fontWeight: 900, marginBottom: 16 },

  dayBlock: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    marginBottom: 16,
    overflow: "hidden",
  },

  dayHeader: {
    padding: 12,
    background: "#f9fafb",
    fontWeight: 900,
    display: "flex",
    justifyContent: "space-between",
  },

  invoiceRow: {
    padding: 12,
    borderTop: "1px solid #f1f5f9",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  itemsBox: {
    background: "#fafafa",
    padding: 12,
    borderTop: "1px solid #e5e7eb",
  },

  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
    fontSize: 14,
  },

  muted: { fontSize: 12, color: "#6b7280" },
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [itemsByInvoice, setItemsByInvoice] = useState<Record<string, InvoiceItem[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function loadInvoices() {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("invoice_date", { ascending: false });

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    setInvoices((data ?? []) as any);
    setLoading(false);
  }

  async function loadItems(invoiceId: string) {
    if (itemsByInvoice[invoiceId]) return;

    const { data, error } = await supabase
      .from("invoice_items")
      .select("id,invoice_id,product_id,qty,unit_cost,line_total,products(slug)")
      .eq("invoice_id", invoiceId)
      .order("id", { ascending: true });

    if (!error) {
      setItemsByInvoice((prev) => ({
        ...prev,
        [invoiceId]: (data ?? []) as any,
      }));
    }
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  const groupedByDay = useMemo(() => {
    const map: Record<string, Invoice[]> = {};

    for (const inv of invoices) {
      const day = inv.invoice_date;
      if (!map[day]) map[day] = [];
      map[day].push(inv);
    }

    return map;
  }, [invoices]);

  if (loading) return <div style={s.page}>Loading invoices...</div>;
  if (err) return <div style={s.page}>Error: {err}</div>;

  return (
    <div style={s.page}>
      <div style={s.header}>Daily Invoices</div>

      {Object.entries(groupedByDay).map(([day, invs]) => {
        const dayTotal = invs.reduce((s0, i) => s0 + Number(i.total_amount || 0), 0);

        return (
          <div key={day} style={s.dayBlock}>
            <div style={s.dayHeader}>
              <span>{formatDate(day)}</span>
              <span>{money(dayTotal)}</span>
            </div>

            {invs.map((inv) => (
              <div key={inv.id}>
                <div
                  style={s.invoiceRow}
                  onClick={async () => {
                    if (expandedId === inv.id) {
                      setExpandedId(null);
                    } else {
                      setExpandedId(inv.id);
                      await loadItems(inv.id);
                    }
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>Invoice #{inv.id.slice(0, 6)}</div>
                    {inv.comments ? <div style={s.muted}>{inv.comments}</div> : null}
                  </div>
                  <div>{money(inv.total_amount)}</div>
                </div>

                {expandedId === inv.id && (
                  <div style={s.itemsBox}>
                    {(itemsByInvoice[inv.id] ?? []).map((it) => (
                      <div key={it.id} style={s.itemRow}>
                        <span>
                          {(it.products?.slug ?? "Unknown product")} × {it.qty}
                        </span>
                        <span>{money(it.line_total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
