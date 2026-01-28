

// app/components/Balance.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

// This component is designed to work even if you haven't created the DB table yet.
// It will attempt to read/write `balances` and will show a helpful error if the table/columns don't exist.
// Recommended table (SQL):
// create table public.balances (
//   id uuid primary key default gen_random_uuid(),
//   balance_date date not null unique,
//   created_at timestamptz not null default now(),
//   cash_sos numeric not null default 0,
//   cash_usd numeric not null default 0,
//   evc numeric not null default 0,
//   edahab numeric not null default 0,
//   merchant numeric not null default 0,
//   note text
// );

type BalanceRow = {
  id: string;
  balance_date: string; // YYYY-MM-DD
  created_at?: string;
  cash_sos: any;
  cash_usd: any;
  evc: any;
  edahab: any;
  merchant: any;
  note?: any;
};

const s: Record<string, React.CSSProperties> = {
  page: { padding: 12, maxWidth: 760, margin: "0 auto", background: "#fff", minHeight: "100vh" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 18, fontWeight: 900 },
  small: { fontSize: 12, color: "#6b7280" },

  card: { marginTop: 10, border: "1px solid #e5e7eb", borderRadius: 14, background: "#fff", padding: 12 },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },

  input: {
    height: 40,
    padding: "0 10px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontSize: 14,
    width: "100%",
    background: "#fff",
  },
  label: { fontSize: 12, fontWeight: 900, color: "#111", marginBottom: 6 },

  btn: {
    height: 40,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnGhost: {
    height: 40,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111",
    fontWeight: 900,
    cursor: "pointer",
  },

  kpis: { display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 8 },
  kpi: { border: "1px solid #e5e7eb", borderRadius: 14, padding: 10, background: "#fff" },
  kpiLabel: { fontSize: 11, color: "#6b7280", fontWeight: 800 },
  kpiValue: { fontSize: 16, fontWeight: 900, color: "#111", marginTop: 4 },

  tableWrap: { marginTop: 10, border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" },
  head: {
    display: "grid",
    gridTemplateColumns: "1fr 120px 120px",
    gap: 8,
    padding: "8px 10px",
    background: "#f8fafc",
    fontSize: 11,
    fontWeight: 900,
    color: "#111",
  },
  line: {
    display: "grid",
    gridTemplateColumns: "1fr 120px 120px",
    gap: 8,
    padding: "8px 10px",
    borderTop: "1px solid #f1f5f9",
    alignItems: "center",
    fontSize: 12,
  },
  right: { textAlign: "right" as const, fontWeight: 900 },
  muted: { color: "#6b7280", fontSize: 11 },

  ok: { marginTop: 10, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", padding: 10, borderRadius: 14, fontSize: 12, fontWeight: 800 },
  err: { marginTop: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", padding: 10, borderRadius: 14, fontSize: 12, fontWeight: 800 },
};

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toNum(v: any) {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function moneyUSD(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  return `$${x.toFixed(2)}`;
}

function moneySOS(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  return `${Math.round(x).toLocaleString()} SOS`;
}

function asLocalDayRange(ymdStr: string) {
  // Convert YYYY-MM-DD (local) -> [fromIso, toIso) in ISO strings
  const [Y, M, D] = ymdStr.split("-").map((x) => Number(x));
  const from = new Date(Y, (M || 1) - 1, D || 1, 0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

export default function Balance() {
  // Date you are cashing up for (usually today)
  const [day, setDay] = useState<string>(() => ymd(new Date()));

  // Inputs
  const [cashSOS, setCashSOS] = useState<string>("");
  const [cashUSD, setCashUSD] = useState<string>("");
  const [evc, setEvc] = useState<string>("");
  const [edahab, setEdahab] = useState<string>("");
  const [merchant, setMerchant] = useState<string>("");
  const [rate, setRate] = useState<string>("36000"); // SOS per 1 USD (edit as needed)
  const [note, setNote] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [todayRow, setTodayRow] = useState<BalanceRow | null>(null);
  const [prevRow, setPrevRow] = useState<BalanceRow | null>(null);

  // Movement (from your tables) for this day
  const [movement, setMovement] = useState<{ inUSD: number; outUSD: number; netUSD: number }>(() => ({ inUSD: 0, outUSD: 0, netUSD: 0 }));

  const totalsNow = useMemo(() => {
    const usdCash = toNum(cashUSD);
    const evcUsd = toNum(evc);
    const edahabUsd = toNum(edahab);
    const merchUsd = toNum(merchant);
    const sos = toNum(cashSOS);
    const fx = Math.max(0, toNum(rate));
    const sosAsUsd = fx > 0 ? sos / fx : 0;

    const usdTotal = usdCash + evcUsd + edahabUsd + merchUsd;
    const overallUsd = usdTotal + sosAsUsd;

    return {
      usdCash,
      evcUsd,
      edahabUsd,
      merchUsd,
      sos,
      fx,
      usdTotal: Number(usdTotal.toFixed(2)),
      sosAsUsd: Number(sosAsUsd.toFixed(2)),
      overallUsd: Number(overallUsd.toFixed(2)),
    };
  }, [cashUSD, evc, edahab, merchant, cashSOS, rate]);

  const totalsPrev = useMemo(() => {
    const fx = Math.max(0, toNum(rate));
    const sos = toNum(prevRow?.cash_sos);
    const sosAsUsd = fx > 0 ? sos / fx : 0;
    const usdCash = toNum(prevRow?.cash_usd);
    const evcUsd = toNum(prevRow?.evc);
    const edahabUsd = toNum(prevRow?.edahab);
    const merchUsd = toNum(prevRow?.merchant);
    const usdTotal = usdCash + evcUsd + edahabUsd + merchUsd;
    const overallUsd = usdTotal + sosAsUsd;
    return {
      usdCash,
      evcUsd,
      edahabUsd,
      merchUsd,
      sos,
      sosAsUsd: Number(sosAsUsd.toFixed(2)),
      usdTotal: Number(usdTotal.toFixed(2)),
      overallUsd: Number(overallUsd.toFixed(2)),
    };
  }, [prevRow, rate]);

  const deltas = useMemo(() => {
    const dUSD = {
      cash: totalsNow.usdCash - totalsPrev.usdCash,
      evc: totalsNow.evcUsd - totalsPrev.evcUsd,
      edahab: totalsNow.edahabUsd - totalsPrev.edahabUsd,
      merchant: totalsNow.merchUsd - totalsPrev.merchUsd,
      total: totalsNow.usdTotal - totalsPrev.usdTotal,
    };
    const dSOS = totalsNow.sos - totalsPrev.sos;
    const dOverallUSD = totalsNow.overallUsd - totalsPrev.overallUsd;

    return {
      dUSD: {
        cash: Number(dUSD.cash.toFixed(2)),
        evc: Number(dUSD.evc.toFixed(2)),
        edahab: Number(dUSD.edahab.toFixed(2)),
        merchant: Number(dUSD.merchant.toFixed(2)),
        total: Number(dUSD.total.toFixed(2)),
      },
      dSOS: Math.round(dSOS),
      dOverallUSD: Number(dOverallUSD.toFixed(2)),
    };
  }, [totalsNow, totalsPrev]);

  const reconciliation = useMemo(() => {
    // If your day had net +$10, your balances should be +$10 compared to yesterday.
    const expected = movement.netUSD;
    const actual = deltas.dOverallUSD;
    const diff = actual - expected;
    return {
      expected: Number(expected.toFixed(2)),
      actual: Number(actual.toFixed(2)),
      diff: Number(diff.toFixed(2)),
    };
  }, [movement, deltas]);

  async function loadBalancesAndMovement() {
    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      // 1) Today row
      const tRes = await supabase
        .from("balances")
        .select("id,balance_date,created_at,cash_sos,cash_usd,evc,edahab,merchant,note")
        .eq("balance_date", day)
        .maybeSingle();

      if (!tRes.error && tRes.data) {
        const r = tRes.data as any as BalanceRow;
        setTodayRow(r);
        setCashSOS(String(toNum(r.cash_sos) || ""));
        setCashUSD(String(toNum(r.cash_usd) || ""));
        setEvc(String(toNum(r.evc) || ""));
        setEdahab(String(toNum(r.edahab) || ""));
        setMerchant(String(toNum(r.merchant) || ""));
        setNote(String(r.note ?? ""));
      } else {
        setTodayRow(null);
        // do not wipe user drafts if table missing
        if (tRes.error && !String(tRes.error.message || "").toLowerCase().includes("does not exist")) {
          // if it's a real error (not just missing table), show it
          // (missing table will be handled below when saving)
        }
      }

      // 2) Previous row (latest before day)
      const pRes = await supabase
        .from("balances")
        .select("id,balance_date,created_at,cash_sos,cash_usd,evc,edahab,merchant,note")
        .lt("balance_date", day)
        .order("balance_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!pRes.error && pRes.data) setPrevRow(pRes.data as any as BalanceRow);
      else setPrevRow(null);

      // 3) Movement for this day (simple, daily, no filters)
      const { fromIso, toIso } = asLocalDayRange(day);

      // POS sales IN: include completed pos orders that are NOT CREDIT (note)
      const salesRes = await supabase
        .from("orders")
        .select("id,created_at,total,note,status,channel")
        .eq("status", "completed")
        .eq("channel", "pos")
        .gte("created_at", fromIso)
        .lt("created_at", toIso)
        .limit(5000);

      // Credit payments IN
      const cpRes = await supabase
        .from("credit_payments")
        .select("id,credit_id,amount,created_at")
        .gte("created_at", fromIso)
        .lt("created_at", toIso)
        .limit(5000);

      // Expenses OUT (your schema uses note not reason; payment_method exists)
      const expRes = await supabase
        .from("expenses")
        .select("id,amount,created_at,note,payment_method")
        .gte("created_at", fromIso)
        .lt("created_at", toIso)
        .limit(5000);

      // Invoices OUT (your schema: invoice_date + total_amount)
      const invRes = await supabase
        .from("invoices")
        .select("id,invoice_date,total_amount,comments,created_at")
        .eq("invoice_date", day)
        .limit(5000);

      let inUSD = 0;
      let outUSD = 0;

      if (!salesRes.error) {
        for (const r of salesRes.data ?? []) {
          const noteRaw = String((r as any)?.note ?? "").trim().toLowerCase();
          const isCredit = noteRaw === "credit" || noteRaw.includes("credit") || noteRaw.includes("deyn");
          if (isCredit) continue;
          const amt = toNum((r as any)?.total);
          if (amt > 0) inUSD += amt;
        }
      }

      if (!cpRes.error) {
        for (const r of cpRes.data ?? []) {
          const amt = toNum((r as any)?.amount);
          if (amt > 0) inUSD += amt;
        }
      }

      if (!expRes.error) {
        for (const r of expRes.data ?? []) {
          const amt = toNum((r as any)?.amount);
          if (amt > 0) outUSD += amt;
        }
      }

      if (!invRes.error) {
        for (const r of invRes.data ?? []) {
          const amt = toNum((r as any)?.total_amount);
          if (amt > 0) outUSD += amt;
        }
      }

      const netUSD = inUSD - outUSD;
      setMovement({
        inUSD: Number(inUSD.toFixed(2)),
        outUSD: Number(outUSD.toFixed(2)),
        netUSD: Number(netUSD.toFixed(2)),
      });

      setLoading(false);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBalancesAndMovement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      const payload = {
        balance_date: day,
        cash_sos: toNum(cashSOS),
        cash_usd: toNum(cashUSD),
        evc: toNum(evc),
        edahab: toNum(edahab),
        merchant: toNum(merchant),
        note: (note ?? "").trim() || null,
      } as any;

      const res = await supabase
        .from("balances")
        .upsert(payload, { onConflict: "balance_date" })
        .select("id,balance_date,created_at,cash_sos,cash_usd,evc,edahab,merchant,note")
        .maybeSingle();

      if (res.error) throw res.error;

      setTodayRow((res.data ?? null) as any);
      setOk("Saved. Now check the difference + reconciliation below.");
      await loadBalancesAndMovement();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      // Most common: balances table doesn't exist yet
      if (String(msg).toLowerCase().includes("balances") && String(msg).toLowerCase().includes("does not exist")) {
        setErr(
          "Balances table not found. Create table `public.balances` (see the SQL comment at the top of this file), then refresh."
        );
      } else {
        setErr(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  const lines = useMemo(() => {
    return [
      { label: "Cash (USD)", prev: moneyUSD(totalsPrev.usdCash), now: moneyUSD(totalsNow.usdCash), delta: moneyUSD(deltas.dUSD.cash) },
      { label: "EVC", prev: moneyUSD(totalsPrev.evcUsd), now: moneyUSD(totalsNow.evcUsd), delta: moneyUSD(deltas.dUSD.evc) },
      { label: "Edahab", prev: moneyUSD(totalsPrev.edahabUsd), now: moneyUSD(totalsNow.edahabUsd), delta: moneyUSD(deltas.dUSD.edahab) },
      { label: "Merchant", prev: moneyUSD(totalsPrev.merchUsd), now: moneyUSD(totalsNow.merchUsd), delta: moneyUSD(deltas.dUSD.merchant) },
      { label: "Cash (SOS)", prev: moneySOS(totalsPrev.sos), now: moneySOS(totalsNow.sos), delta: moneySOS(deltas.dSOS) },
    ];
  }, [totalsPrev, totalsNow, deltas]);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Balances (Night Cash-Up)</h2>
          <div style={s.small}>Do this first every night → then compare vs money in/out</div>
        </div>

        <div style={s.row}>
          <button type="button" style={s.btnGhost} onClick={loadBalancesAndMovement} disabled={loading || saving}>
            Refresh
          </button>
          <button type="button" style={s.btn} onClick={save} disabled={loading || saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.row}>
          <div style={{ width: 180 }}>
            <div style={s.label}>Date</div>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} style={s.input} />
            <div style={s.muted}>Record end-of-day balances</div>
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={s.label}>FX (SOS per 1 USD)</div>
            <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" placeholder="e.g. 36000" style={s.input} />
            <div style={s.muted}>Used only for overall difference (SOS → USD)</div>
          </div>
        </div>

        <div style={{ height: 10 }} />

        <div style={s.grid}>
          <div>
            <div style={s.label}>EVC (USD)</div>
            <input value={evc} onChange={(e) => setEvc(e.target.value)} inputMode="decimal" placeholder="0" style={s.input} />
          </div>
          <div>
            <div style={s.label}>Edahab (USD)</div>
            <input value={edahab} onChange={(e) => setEdahab(e.target.value)} inputMode="decimal" placeholder="0" style={s.input} />
          </div>
          <div>
            <div style={s.label}>Merchant (USD)</div>
            <input value={merchant} onChange={(e) => setMerchant(e.target.value)} inputMode="decimal" placeholder="0" style={s.input} />
          </div>
          <div>
            <div style={s.label}>Cash (USD)</div>
            <input value={cashUSD} onChange={(e) => setCashUSD(e.target.value)} inputMode="decimal" placeholder="0" style={s.input} />
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <div style={s.label}>Cash (SOS)</div>
            <input value={cashSOS} onChange={(e) => setCashSOS(e.target.value)} inputMode="numeric" placeholder="0" style={s.input} />
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <div style={s.label}>Note (optional)</div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. cash counted with Ahmed" style={s.input} />
          </div>
        </div>

        {todayRow ? <div style={{ marginTop: 8, ...s.muted }}>Saved row: {todayRow.id.slice(0, 8)} • {String(todayRow.created_at ?? "").slice(0, 19)}</div> : null}

        {err ? <div style={s.err}>{err}</div> : null}
        {ok ? <div style={s.ok}>{ok}</div> : null}
      </div>

      <div style={s.card}>
        <div style={s.kpis}>
          <div style={{ ...s.kpi, gridColumn: "span 4" }}>
            <div style={s.kpiLabel}>USD total (EVC+Edahab+Merchant+USD cash)</div>
            <div style={s.kpiValue}>{moneyUSD(totalsNow.usdTotal)}</div>
            <div style={s.muted}>Yesterday: {moneyUSD(totalsPrev.usdTotal)} • Δ {moneyUSD(deltas.dUSD.total)}</div>
          </div>

          <div style={{ ...s.kpi, gridColumn: "span 4" }}>
            <div style={s.kpiLabel}>SOS total</div>
            <div style={s.kpiValue}>{moneySOS(totalsNow.sos)}</div>
            <div style={s.muted}>Yesterday: {moneySOS(totalsPrev.sos)} • Δ {moneySOS(deltas.dSOS)}</div>
          </div>

          <div style={{ ...s.kpi, gridColumn: "span 4" }}>
            <div style={s.kpiLabel}>Overall (USD + SOS→USD)</div>
            <div style={s.kpiValue}>{moneyUSD(totalsNow.overallUsd)}</div>
            <div style={s.muted}>Yesterday: {moneyUSD(totalsPrev.overallUsd)} • Δ {moneyUSD(deltas.dOverallUSD)}</div>
          </div>
        </div>

        <div style={s.tableWrap}>
          <div style={s.head}>
            <div>Method</div>
            <div style={s.right}>Yesterday</div>
            <div style={s.right}>Today (Δ)</div>
          </div>

          {lines.map((r) => (
            <div key={r.label} style={s.line}>
              <div style={{ fontWeight: 900 }}>{r.label}</div>
              <div style={s.right}>{r.prev}</div>
              <div style={s.right}>
                {r.now}
                <div style={s.muted}>Δ {r.delta}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={s.card}>
        <div style={{ fontWeight: 900 }}>Reconciliation (difference vs money in/out)</div>
        <div style={{ ...s.small, marginTop: 4 }}>
          Expected change is computed from: POS paid sales + credit payments − expenses − invoices (for the day).
        </div>

        <div style={{ height: 10 }} />

        <div style={s.kpis}>
          <div style={{ ...s.kpi, gridColumn: "span 4" }}>
            <div style={s.kpiLabel}>Cash IN (USD)</div>
            <div style={s.kpiValue}>{moneyUSD(movement.inUSD)}</div>
          </div>
          <div style={{ ...s.kpi, gridColumn: "span 4" }}>
            <div style={s.kpiLabel}>Cash OUT (USD)</div>
            <div style={s.kpiValue}>{moneyUSD(movement.outUSD)}</div>
          </div>
          <div style={{ ...s.kpi, gridColumn: "span 4" }}>
            <div style={s.kpiLabel}>Net movement (Expected)</div>
            <div style={s.kpiValue}>{moneyUSD(movement.netUSD)}</div>
          </div>
        </div>

        <div style={{ height: 10 }} />

        <div style={s.kpis}>
          <div style={{ ...s.kpi, gridColumn: "span 4" }}>
            <div style={s.kpiLabel}>Actual change (from balances)</div>
            <div style={s.kpiValue}>{moneyUSD(reconciliation.actual)}</div>
          </div>
          <div style={{ ...s.kpi, gridColumn: "span 4" }}>
            <div style={s.kpiLabel}>Expected change (from cashbook)</div>
            <div style={s.kpiValue}>{moneyUSD(reconciliation.expected)}</div>
          </div>
          <div style={{ ...s.kpi, gridColumn: "span 4" }}>
            <div style={s.kpiLabel}>Difference (should be ~0)</div>
            <div style={{ ...s.kpiValue, color: Math.abs(reconciliation.diff) < 0.01 ? "#166534" : "#b91c1c" }}>
              {moneyUSD(reconciliation.diff)}
            </div>
            <div style={s.muted}>{Math.abs(reconciliation.diff) < 0.01 ? "OK" : "Investigate: missing entry / wrong count"}</div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 560px) {
          .balance-2col {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}