"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type LedgerKind = "cash_in" | "cash_out";

type LedgerLine = {
  id: string;
  kind: LedgerKind;
  created_at: string;
  source: "sale" | "credit_payment" | "expense" | "invoice";
  amount: number; // always positive
  method: string; // cash | evc | edahab | unknown
  title: string;
  ref?: string | null;
};

const s: Record<string, React.CSSProperties> = {
  page: { padding: 8, maxWidth: 520, margin: "0 auto", background: "#fff", minHeight: "100vh" },

  header: { display: "flex", flexDirection: "column", gap: 8 },
  title: { margin: 0, fontSize: 16, fontWeight: 900, lineHeight: 1.1 },
  small: { fontSize: 11, color: "#6b7280" },

  topRow: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 8px",
    borderRadius: 10,
    border: "1px solid #eef2f7",
    background: "#fafafa",
    fontSize: 11,
    fontWeight: 900,
    color: "#111",
  },

  btn: {
    height: 34,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
  },

  card: {
    marginTop: 8,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#fff",
    padding: 8,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },

  controls: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" },

  input: {
    height: 42,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontSize: 14,
    background: "#fff",
    width: "100%",
  },
  select: {
    height: 42,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontSize: 14,
    background: "#fff",
  },

  listWrap: { marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" },
  empty: { padding: 12, color: "#6b7280", fontWeight: 700 },

  rowItem: {
    padding: "8px 10px",
    borderTop: "1px solid #f1f5f9",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },

  left: { minWidth: 0, flex: 1 },
  strong: { fontWeight: 900, color: "#111", fontSize: 13 },
  muted: { fontSize: 11, color: "#6b7280" },

  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #eef2f7",
    background: "#fafafa",
    fontSize: 11,
    fontWeight: 900,
  },

  amtIn: { fontWeight: 900, color: "#0B6EA9", whiteSpace: "nowrap" as const },
  amtOut: { fontWeight: 900, color: "#b42318", whiteSpace: "nowrap" as const },

  errBox: {
    marginTop: 10,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
    padding: 10,
    borderRadius: 14,
    fontSize: 13,
    fontWeight: 700,
  },
};

function toNum(v: any) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function money(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  return `$${x.toFixed(2)}`;
}

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todayLocalRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { ymdStr: ymd(from), fromIso: from.toISOString(), toIso: to.toISOString() };
}

function formatTime(dt: string) {
  try {
    const d = new Date(dt);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
}

function normalizeMethod(raw: any): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  if (s.includes("evc")) return "evc";
  if (s.includes("edahab")) return "edahab";
  if (s.includes("cash")) return "cash";
  return s;
}

export default function Cashbook() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [lines, setLines] = useState<LedgerLine[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);

    const { ymdStr, fromIso, toIso } = todayLocalRange();

    try {
      // 1) CASH IN: paid sales (orders completed, channel=pos, NOT credit)
      const salesRes = await supabase
        .from("orders")
        .select("id,created_at,total,status,channel,note")
        .eq("status", "completed")
        .eq("channel", "pos")
        // HARD FILTER (DB): include rows where note is NULL OR (note is not credit AND not deyn)
        .or("note.is.null,and(note.not.ilike.%credit%,note.not.ilike.%deyn%)")
        .gte("created_at", fromIso)
        .lt("created_at", toIso)
        .limit(5000);

      // 2) CASH IN: credit payments
      const cpRes = await supabase
        .from("credit_payments")
        .select("id,credit_id,amount,created_at")
        .gte("created_at", fromIso)
        .lt("created_at", toIso)
        .limit(5000);

      // 3) CASH OUT: expenses
      const expRes = await supabase
        .from("expenses")
        .select("id,created_at,amount,reason,payment_method")
        .gte("created_at", fromIso)
        .lt("created_at", toIso)
        .limit(5000);

      // 4) CASH OUT: invoices (your schema has invoice_date + total_amount)
      // Prefer invoice_date equality; fallback to created_at range.
      const invByDate = await supabase
        .from("invoices")
        .select("id,invoice_date,total_amount,comments,created_at")
        .eq("invoice_date", ymdStr)
        .limit(5000);

      const invRes = invByDate.error
        ? await supabase
            .from("invoices")
            .select("id,invoice_date,total_amount,comments,created_at")
            .gte("created_at", fromIso)
            .lt("created_at", toIso)
            .limit(5000)
        : invByDate;

      // Build ledger
      const out: LedgerLine[] = [];

      if (!salesRes.error) {
        for (const r of salesRes.data ?? []) {
          // EXTRA SAFE: never show CREDIT sales in cashbook (any spelling/case/whitespace)
          const noteRaw = String((r as any)?.note ?? "").trim().toLowerCase();
          const isCreditNote = noteRaw === "credit" || noteRaw.includes("credit") || noteRaw.includes("deyn");
          if (isCreditNote) {
            console.warn("[Cashbook] Excluding CREDIT/DEYN order", (r as any)?.id, (r as any)?.note);
            continue;
          }

          const amt = toNum((r as any)?.total);
          if (amt <= 0) continue;

          out.push({
            id: `sale:${(r as any).id}`,
            kind: "cash_in",
            created_at: (r as any).created_at,
            source: "sale",
            amount: amt,
            method: "unknown",
            title: noteRaw ? `Sale (pos) • ${noteRaw.toUpperCase()}` : "Sale (pos)",
            ref: (r as any).id,
          });
        }
      }

      if (!cpRes.error) {
        for (const r of cpRes.data ?? []) {
          const amt = toNum((r as any)?.amount);
          if (amt <= 0) continue;
          out.push({
            id: `credit_payment:${(r as any).id}`,
            kind: "cash_in",
            created_at: (r as any).created_at,
            source: "credit_payment",
            amount: amt,
            method: "unknown",
            title: "Credit payment",
            ref: (r as any).credit_id ?? null,
          });
        }
      }

      if (!expRes.error) {
        for (const r of expRes.data ?? []) {
          const amt = toNum((r as any)?.amount);
          if (amt <= 0) continue;
          out.push({
            id: `expense:${(r as any).id}`,
            kind: "cash_out",
            created_at: (r as any).created_at,
            source: "expense",
            amount: amt,
            method: normalizeMethod((r as any).payment_method),
            title: String((r as any).reason ?? "Expense").trim() || "Expense",
            ref: (r as any).id,
          });
        }
      }

      if (!invRes.error) {
        for (const r of invRes.data ?? []) {
          const amt = toNum((r as any)?.total_amount);
          if (amt <= 0) continue;
          const dt = (r as any).created_at ?? `${(r as any).invoice_date}T00:00:00.000Z`;
          out.push({
            id: `invoice:${(r as any).id}`,
            kind: "cash_out",
            created_at: dt,
            source: "invoice",
            amount: amt,
            method: "unknown",
            title: String((r as any).comments ?? "Invoice").trim() || "Invoice",
            ref: (r as any).id,
          });
        }
      }

      // Sort newest first
      out.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setLines(out);
      setLoading(false);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setLines([]);
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = lines;

  const totals = useMemo(() => {
    const cashIn = filtered.filter((x) => x.kind === "cash_in").reduce((s0, x) => s0 + x.amount, 0);
    const cashOut = filtered.filter((x) => x.kind === "cash_out").reduce((s0, x) => s0 + x.amount, 0);
    return {
      cashIn: Number(cashIn.toFixed(2)),
      cashOut: Number(cashOut.toFixed(2)),
      net: Number((cashIn - cashOut).toFixed(2)),
    };
  }, [filtered]);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h2 style={s.title}>Cashbook</h2>
        <div style={s.small}>Today’s cash in/out</div>

        <div style={s.topRow}>
          <span style={s.badge}>In {money(totals.cashIn)}</span>
          <span style={s.badge}>Out {money(totals.cashOut)}</span>
          <span style={s.badge}>Net {money(totals.net)}</span>
          <button type="button" style={s.btn} onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div style={s.card}>
        {err ? <div style={s.errBox}>{err}</div> : null}
      </div>

      <div style={s.listWrap}>
        {loading ? (
          <div style={s.empty}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>No entries.</div>
        ) : (
          filtered.map((l, idx) => (
            <div
              key={l.id}
              style={{ ...s.rowItem, borderTop: idx === 0 ? "none" : "1px solid #f1f5f9" }}
            >
              <div style={s.left}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={s.chip}>{l.kind === "cash_in" ? "IN" : "OUT"}</span>
                  <span style={s.chip}>{l.method === "unknown" ? "—" : l.method.toUpperCase()}</span>
                  <span style={s.muted}>{formatTime(l.created_at)}</span>
                </div>

                <div style={{ marginTop: 6 }}>
                  <div style={s.strong}>{l.title}</div>
                  <div style={s.muted}>
                    {l.source}
                    {l.ref ? ` • ${String(l.ref).slice(0, 14)}` : ""}
                  </div>
                </div>
              </div>

              <div style={l.kind === "cash_in" ? s.amtIn : s.amtOut}>{money(l.amount)}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 10, ...s.small }}>
        Today only.
      </div>
    </div>
  );
}