"use client";

import React, { useMemo, useState } from "react";
import ProductManager from "./components/ProductManager";
import ProductFillCards from "./components/al";
import Online from "./components/Online";
import OrdersManager from "./components/OrdersManager";
import POS from "./components/POS";
import CreditsManager from "./components/CreditsManager";
import PNL from "./components/PNL";
import Price from "./components/price";
import Upload from "./components/Upload";

type SectionKey = "products" | "fill" | "online" | "pricing" | "upload" | "orders" | "pos" | "credits" | "pnl";

type NavItem = { key: SectionKey; label: string; icon: string };

const NAV: NavItem[] = [
    { key: "pos", label: "POS", icon: "🧾" },

  { key: "products", label: "Products", icon: "📦" },
  // { key: "fill", label: "Fill Missing", icon: "🧩" },
  // { key: "online", label: "Online", icon: "🌐" },
  // { key: "pricing", label: "Pricing", icon: "💰" },
  // { key: "upload", label: "Upload", icon: "⬆️" },
  { key: "orders", label: "Orders", icon: "📋" },
  { key: "credits", label: "Credits", icon: "💳" },
  { key: "pnl", label: "P&L", icon: "📈" },
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
};

export default function Page() {
  const [active, setActive] = useState<SectionKey>("products");

  const activeLabel = useMemo(() => NAV.find((n) => n.key === active)?.label ?? "", [active]);

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

        {active === "products" ? (
          <ProductManager />
        ) : active === "fill" ? (
          <ProductFillCards />
        ) : active === "online" ? (
          <Online />
        ) : active === "pricing" ? (
          <Price />
        ) : active === "upload" ? (
          <Upload />
        ) : active === "pos" ? (
          <POS />
        ) : active === "orders" ? (
          <OrdersManager />
        ) : active === "credits" ? (
          <CreditsManager />
        ) : (
          <PNL />
        )}
      </div>
    </div>
  );
}