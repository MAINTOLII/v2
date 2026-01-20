

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type CustomerRow = {
  id: string | number;
  name: string | null;
  phone: string | number | null;
};

type RowState = {
  name: string;
  dirty: boolean;
  saving: boolean;
  error?: string;
};

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: 12,
    background: "#fafafa",
    minHeight: "100vh",
    color: "#111",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },
  container: { maxWidth: 920, margin: "0 auto", display: "grid", gap: 12 },
  sticky: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: "rgba(250,250,250,0.92)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    borderBottom: "1px solid #e5e7eb",
    padding: "10px 10px",
  },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 18, fontWeight: 950, letterSpacing: "-0.02em" },
  small: { fontSize: 12, opacity: 0.75 },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    fontSize: 12,
    fontWeight: 900,
    background: "#fff",
    whiteSpace: "nowrap",
  },
  input: {
    height: 36,
    padding: "7px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontSize: 14,
    background: "#fff",
  },
  btn: {
    height: 36,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnGhost: {
    height: 36,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnDanger: {
    height: 36,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid #f1c4c4",
    background: "#fff",
    color: "#b42318",
    fontWeight: 900,
    cursor: "pointer",
  },
  list: { display: "grid", gap: 10 },
  custCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#fff",
    padding: 12,
    display: "grid",
    gap: 8,
  },
  line: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" },
  strong: { fontWeight: 950 },
  hr: { height: 1, background: "#f1f5f9", border: 0, margin: "6px 0" },
  err: { color: "#b42318", fontWeight: 900, fontSize: 13 },
  ok: { color: "#067647", fontWeight: 900, fontSize: 13 },
};

function safeStr(v: any) {
  return v == null ? "" : String(v);
}

export default function Customer() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(500);

  const [rows, setRows] = useState<Record<string, RowState>>({});

  const searchRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    // NOTE: keep this select minimal to be fast. Add more fields later if you want.
    const { data, error } = await supabase
      .from("customers")
      .select("id,name,phone")
      .order("id", { ascending: false })
      .limit(5000);

    if (error) {
      setCustomers([]);
      setRows({});
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as CustomerRow[];
    setCustomers(list);

    // seed editable state
    const seed: Record<string, RowState> = {};
    for (const c of list) {
      const key = safeStr(c.id);
      seed[key] = {
        name: safeStr(c.name),
        dirty: false,
        saving: false,
      };
    }
    setRows(seed);

    setLoading(false);
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return customers.slice(0, limit);

    const out: CustomerRow[] = [];
    for (const c of customers) {
      const phone = safeStr(c.phone).toLowerCase();
      const name = safeStr(c.name).toLowerCase();
      const id = safeStr(c.id).toLowerCase();
      if (phone.includes(qq) || name.includes(qq) || id.includes(qq)) out.push(c);
      if (out.length >= limit) break;
    }
    return out;
  }, [customers, q, limit]);

  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const k of Object.keys(rows)) {
      if (rows[k]?.dirty) n++;
    }
    return n;
  }, [rows]);

  async function saveName(c: CustomerRow) {
    const key = safeStr(c.id);
    const st = rows[key];
    if (!st) return;

    const nextName = (st.name ?? "").trim();

    setRows((p) => ({
      ...p,
      [key]: { ...p[key], saving: true, error: undefined },
    }));
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const { error } = await supabase.from("customers").update({ name: nextName }).eq("id", c.id);
      if (error) throw new Error(error.message);

      setCustomers((prev) => prev.map((x) => (safeStr(x.id) === key ? { ...x, name: nextName } : x)));
      setRows((p) => ({
        ...p,
        [key]: { ...p[key], saving: false, dirty: false, error: undefined },
      }));
      setSuccessMsg("Saved.");
    } catch (e: any) {
      const msg = e?.message ?? "Save failed";
      setRows((p) => ({
        ...p,
        [key]: { ...p[key], saving: false, error: msg },
      }));
      setErrorMsg(msg);
    }
  }

  async function saveAll() {
    setErrorMsg("");
    setSuccessMsg("");

    const dirty = customers.filter((c) => rows[safeStr(c.id)]?.dirty);
    if (dirty.length === 0) {
      setSuccessMsg("No changes.");
      return;
    }

    for (const c of dirty) {
      // eslint-disable-next-line no-await-in-loop
      await saveName(c);
    }
  }

  function resetRow(c: CustomerRow) {
    const key = safeStr(c.id);
    setRows((p) => ({
      ...p,
      [key]: { ...p[key], name: safeStr(c.name), dirty: false, error: undefined },
    }));
  }

  return (
    <main style={s.page}>
      <div style={s.container}>
        <div style={s.sticky}>
          <div style={s.headerTop}>
            <div>
              <h1 style={s.title}>Customers</h1>
              <div style={s.small}>Search by phone / name / id • Edit name and save</div>
            </div>

            <div style={s.row}>
              <button style={s.btnGhost} type="button" onClick={() => load()} disabled={loading}>
                {loading ? "Loading…" : "Refresh"}
              </button>
              <button
                style={{
                  ...s.btn,
                  opacity: dirtyCount === 0 ? 0.6 : 1,
                  cursor: dirtyCount === 0 ? "not-allowed" : "pointer",
                }}
                type="button"
                onClick={() => saveAll()}
                disabled={dirtyCount === 0}
              >
                Save all ({dirtyCount})
              </button>
            </div>
          </div>

          <div style={{ ...s.row, marginTop: 10 }}>
            <input
              ref={searchRef}
              style={{ ...s.input, flex: 1, minWidth: 220 }}
              placeholder={loading ? "Loading…" : "Search phone / name / id"}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <select
              style={s.input}
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value="100">show 100</option>
              <option value="300">show 300</option>
              <option value="500">show 500</option>
              <option value="1000">show 1000</option>
            </select>

            <span style={s.badge}>Total: {customers.length}</span>
          </div>

          {errorMsg ? <div style={{ ...s.err, marginTop: 8 }}>{errorMsg}</div> : null}
          {successMsg ? <div style={{ ...s.ok, marginTop: 8 }}>{successMsg}</div> : null}
        </div>

        <section style={s.card}>
          {loading ? (
            <div style={{ opacity: 0.75 }}>Loading…</div>
          ) : customers.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No customers.</div>
          ) : (
            <div style={s.list}>
              {filtered.map((c) => {
                const key = safeStr(c.id);
                const st = rows[key] ?? { name: safeStr(c.name), dirty: false, saving: false };

                return (
                  <div key={key} style={s.custCard}>
                    <div style={s.line}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={s.strong}>
                          {st.name?.trim() ? st.name.trim() : "Customer"}{" "}
                          <span style={{ fontWeight: 800, opacity: 0.7 }}>• {safeStr(c.phone) || "no phone"}</span>
                        </div>
                        <div style={s.small}>ID: {safeStr(c.id)}</div>
                      </div>

                      <div style={s.row}>
                        <span style={s.badge}>customer</span>
                      </div>
                    </div>

                    <hr style={s.hr} />

                    <div style={s.row}>
                      <input
                        style={{ ...s.input, flex: 1, minWidth: 220 }}
                        value={st.name}
                        placeholder="Customer name"
                        onChange={(e) => {
                          const v = e.target.value;
                          setRows((p) => ({
                            ...p,
                            [key]: {
                              ...p[key],
                              name: v,
                              dirty: v.trim() !== safeStr(c.name).trim(),
                              error: undefined,
                            },
                          }));
                        }}
                        disabled={st.saving}
                      />

                      <button
                        type="button"
                        style={{
                          ...s.btn,
                          opacity: st.dirty && !st.saving ? 1 : 0.6,
                          cursor: st.dirty && !st.saving ? "pointer" : "not-allowed",
                        }}
                        disabled={!st.dirty || st.saving}
                        onClick={() => saveName(c)}
                      >
                        {st.saving ? "Saving…" : "Save"}
                      </button>

                      <button
                        type="button"
                        style={{
                          ...s.btnGhost,
                          opacity: st.dirty && !st.saving ? 1 : 0.6,
                          cursor: st.dirty && !st.saving ? "pointer" : "not-allowed",
                        }}
                        disabled={!st.dirty || st.saving}
                        onClick={() => resetRow(c)}
                      >
                        Reset
                      </button>
                    </div>

                    {st.error ? <div style={s.err}>{st.error}</div> : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}