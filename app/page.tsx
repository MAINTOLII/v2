/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
type CashOutTotals = { expenses: number; invoices: number };

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfTomorrowISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(n: number) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}


import ProductManager from "./components/ProductManager";
import Online from "./components/Online";
import POS from "./components/POS";
import Price from "./components/price";
import Sales from "./components/Sales";
import Inventory from "./components/In";
import QtyCost from "./components/qtycost";
import Invoices from "./components/Invoices";
import CreditsManager from "./components/CreditsManager";
import Expenses from "./components/Expenses";
import Cashbook from "./components/Cashbook";
import Alerts from "./components/Alerts";
import Balance from "./components/Balance";
type SectionKey =
  | "pos"
  | "sales"
  | "credit"
  | "cashout"
  | "products";

type ProductsSectionKey =
  | "alerts"
  | "manage"
  | "qtycost"
  | "pricing"
  | "online";

type CashOutSectionKey =
  | "inventory"
  | "cashbook"
  | "invoices"
  | "expenses"
  | "balance";

type NavItem = { key: SectionKey; label: string; icon: string };

const NAV: NavItem[] = [
  { key: "pos", label: "POS", icon: "🧾" },
  { key: "sales", label: "Sales", icon: "📊" },
  { key: "credit", label: "Credit", icon: "💳" },
  { key: "cashout", label: "Cash Out", icon: "💸" },
  { key: "products", label: "Products", icon: "🏷️" },
];

type ProductsNavItem = { key: ProductsSectionKey; label: string; icon: string };

const PRODUCT_NAV: ProductsNavItem[] = [
  { key: "alerts", label: "Alerts", icon: "🚨" },
  { key: "manage", label: "Manage", icon: "📦" },
  { key: "qtycost", label: "Qty/Cost", icon: "🧮" },
  { key: "pricing", label: "Pricing", icon: "💰" },
  { key: "online", label: "Online", icon: "🌐" },
];

type CashOutNavItem = { key: CashOutSectionKey; label: string; icon: string };

const CASHOUT_NAV: CashOutNavItem[] = [
  { key: "inventory", label: "Inventory", icon: "📦" },
  { key: "cashbook", label: "Cashbook", icon: "📒" },
  { key: "invoices", label: "Invoices", icon: "🧾" },
  { key: "expenses", label: "Expenses", icon: "💳" },
  { key: "balance", label: "Balance", icon: "⚖️" },
];

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    display: "flex",
    background: "#fafafa",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    color: "#111",
  },
  sidebar: {
    width: 260,
    borderRight: "1px solid #e5e7eb",
    background: "white",
    position: "sticky",
    top: 0,
    alignSelf: "flex-start",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  brand: {
    padding: 14,
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  brandTitle: { fontWeight: 900, letterSpacing: "-0.02em", fontSize: 16 },
  brandTag: {
    fontSize: 12,
    opacity: 0.7,
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    padding: "2px 8px",
    background: "#fff",
    whiteSpace: "nowrap",
  },
  nav: { padding: 10, display: "grid", gap: 8 },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 800,
  },
  navItemActive: { background: "#111", color: "#fff", border: "1px solid #111" },
  navIcon: { width: 22, display: "inline-flex", justifyContent: "center" },
  spacer: { flex: 1 },
  sidebarFooter: { padding: 12, borderTop: "1px solid #f1f5f9", fontSize: 12, opacity: 0.7 },
  main: { flex: 1, minWidth: 0 },
  mobileTop: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    background: "white",
    borderBottom: "1px solid #e5e7eb",
    padding: 12,
    display: "none",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  mobileSelect: {
    height: 36,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    padding: "6px 10px",
    fontWeight: 800,
    background: "#fff",
  },
  subnavWrap: {
    padding: 12,
    borderBottom: "1px solid #e5e7eb",
    background: "#fff",
    position: "sticky",
    top: 0,
    zIndex: 9,
  },
  subnavRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  subnavBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    height: 36,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
  },
  subnavBtnActive: { background: "#111", color: "#fff", border: "1px solid #111" },
};

export default function Page() {
  const [active, setActive] = useState<SectionKey>("pos");
  const [productsActive, setProductsActive] = useState<ProductsSectionKey>("alerts");
  const [cashOutActive, setCashOutActive] = useState<CashOutSectionKey>("cashbook");
  const [cashOutTotals, setCashOutTotals] = useState<CashOutTotals>({ expenses: 0, invoices: 0 });
  const [cashOutLoading, setCashOutLoading] = useState(false);

  const activeLabel = useMemo(() => NAV.find((n) => n.key === active)?.label ?? "", [active]);

  useEffect(() => {
    let cancelled = false;

    async function loadCashOutToday() {
      if (active !== "cashout") return;

      setCashOutLoading(true);
      try {
        const fromIso = startOfTodayISO();
        const toIso = startOfTomorrowISO();

        // Expenses: try to read rows for today and sum `amount`.
        const expRes = await supabase
          .from("expenses")
          .select("amount,created_at")
          .gte("created_at", fromIso)
          .lt("created_at", toIso)
          .limit(5000);

        const expenses = (expRes.data ?? []).reduce((s, r: any) => s + toNum(r?.amount), 0);

        // Invoices (your schema): invoice_date (YYYY-MM-DD) + total_amount (string/number)
        // NOTE: PostgREST returns 400 if you request columns that don't exist, so keep select minimal.
        async function sumInvoicesForToday(): Promise<number> {
          // today in YYYY-MM-DD (local)
          const d = new Date();
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const today = `${yyyy}-${mm}-${dd}`;

          // Prefer invoice_date (date column)
          const byInvoiceDate = await supabase
            .from("invoices")
            .select("invoice_date,total_amount")
            .eq("invoice_date", today)
            .limit(5000);

          if (!byInvoiceDate.error) {
            const rows = Array.isArray(byInvoiceDate.data) ? byInvoiceDate.data : [];
            return rows.reduce((sum, r: any) => sum + toNum(r?.total_amount), 0);
          }

          // Fallback: created_at range (timestamp)
          const byCreatedAt = await supabase
            .from("invoices")
            .select("created_at,total_amount")
            .gte("created_at", fromIso)
            .lt("created_at", toIso)
            .limit(5000);

          if (byCreatedAt.error) return 0;
          const rows = Array.isArray(byCreatedAt.data) ? byCreatedAt.data : [];
          return rows.reduce((sum, r: any) => sum + toNum(r?.total_amount), 0);
        }

        const invoices = await sumInvoicesForToday();

        if (!cancelled) {
          setCashOutTotals({
            expenses: Number(expenses.toFixed(2)),
            invoices: Number(invoices.toFixed(2)),
          });
        }
      } catch {
        if (!cancelled) setCashOutTotals({ expenses: 0, invoices: 0 });
      } finally {
        if (!cancelled) setCashOutLoading(false);
      }
    }

    loadCashOutToday();
    return () => {
      cancelled = true;
    };
  }, [active]);

  return (
    <div style={styles.shell}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 860px) {
              .mato-sidebar { display: none !important; }
              .mato-mobile-top { display: flex !important; }
            }
          `,
        }}
      />

      <aside className="mato-sidebar" style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={{ display: "grid", gap: 2 }}>
            <div style={styles.brandTitle}>Mato Admin</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Dashboard</div>
          </div>
          <span style={styles.brandTag}>{activeLabel}</span>
        </div>

        <nav style={styles.nav}>
          {NAV.map((item) => {
            const isActive = item.key === active;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActive(item.key)}
                style={{ ...styles.navItem, ...(isActive ? styles.navItemActive : null) }}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div style={styles.spacer} />
        <div style={styles.sidebarFooter}>© Mato • Simple admin panel</div>
      </aside>

      <div style={styles.main}>
        <div className="mato-mobile-top" style={styles.mobileTop}>
          <span style={{ fontWeight: 900 }}>Mato Admin</span>
          <select
            style={styles.mobileSelect}
            value={active}
            onChange={(e) => setActive(e.target.value as SectionKey)}
          >
            {NAV.map((n) => (
              <option key={n.key} value={n.key}>
                {n.label}
              </option>
            ))}
          </select>
        </div>

        {active === "pos" ? (
          <POS />
        ) : active === "sales" ? (
          <Sales />
        ) : active === "credit" ? (
          <CreditsManager />
        ) : active === "cashout" ? (
          <>
            <div style={styles.subnavWrap}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 900 }}>Cash Out</div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>Today</div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>
                    {cashOutLoading
                      ? "Loading…"
                      : money((cashOutTotals.expenses || 0) + (cashOutTotals.invoices || 0))}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
                    Expenses {money(cashOutTotals.expenses)} • Invoices {money(cashOutTotals.invoices)}
                  </div>
                </div>
              </div>

              <div style={{ height: 10 }} />
              <div style={styles.subnavRow}>
                {CASHOUT_NAV.map((it) => {
                  const isOn = it.key === cashOutActive;
                  return (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => setCashOutActive(it.key)}
                      style={{ ...styles.subnavBtn, ...(isOn ? styles.subnavBtnActive : null) }}
                    >
                      <span style={{ width: 18, display: "inline-flex", justifyContent: "center" }}>
                        {it.icon}
                      </span>
                      {it.label}
                    </button>
                  );
                })}
              </div>
       </div>

{cashOutActive === "inventory" ? (
  <Inventory />
) : cashOutActive === "cashbook" ? (
  <Cashbook />
) : cashOutActive === "invoices" ? (
  <Invoices />
) : cashOutActive === "expenses" ? (
  <Expenses />
) : cashOutActive === "balance" ? (
  <Balance />
) : null}
          </>
        ) : active === "products" ? (
          <>
            <div style={styles.subnavWrap}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Products</div>
              <div style={styles.subnavRow}>
                {PRODUCT_NAV.map((it) => {
                  const isOn = it.key === productsActive;
                  return (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => setProductsActive(it.key)}
                      style={{ ...styles.subnavBtn, ...(isOn ? styles.subnavBtnActive : null) }}
                    >
                      <span style={{ width: 18, display: "inline-flex", justifyContent: "center" }}>{it.icon}</span>
                      {it.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {productsActive === "alerts" ? (
              <Alerts />
            ) : productsActive === "manage" ? (
              <ProductManager />
            ) : productsActive === "qtycost" ? (
              <QtyCost />
            ) : productsActive === "pricing" ? (
              <Price />
            ) : productsActive === "online" ? (
              <Online />
            ) : null}
          </>
        ) : (
          <div style={{ padding: 16, color: "#555", fontWeight: 700 }}>Select a section</div>
        )}
      </div>
    </div>
  );
}