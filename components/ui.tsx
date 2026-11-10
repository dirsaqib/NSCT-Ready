"use client";
// Small UI kit shared by every panel.
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    if (!path) return;
    setError("");
    api<T>(path).then(setData).catch((e) => setError(e.message));
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(reload, [reload, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, reload, setData };
}

export function Page({ title, sub, actions, children }: { title: string; sub?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <div className="top"><div><h1>{title}</h1>{sub && <p className="sub">{sub}</p>}</div>{actions && <div className="row">{actions}</div>}</div>
      {children}
    </>
  );
}

export function Loading({ error }: { error?: string }) {
  return error ? <div className="notice bad">{error}</div> : <div className="spin" />;
}

export function Stat({ k, v, d }: { k: string; v: React.ReactNode; d?: React.ReactNode }) {
  return <div className="card stat"><div className="k">{k}</div><div className="v">{v}</div>{d && <div className="d">{d}</div>}</div>;
}

export function Card({ title, children, right, style }: { title?: string; children: React.ReactNode; right?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="card" style={style}>
      {(title || right) && <div className="row between" style={{ marginBottom: 10 }}>{title && <h2 style={{ margin: 0 }}>{title}</h2>}{right}</div>}
      {children}
    </div>
  );
}

export function Table<T>({ rows, cols, empty = "Nothing here yet.", onRow }: { rows: T[]; cols: [string, (r: T) => React.ReactNode][]; empty?: string; onRow?: (r: T) => void }) {
  if (!rows.length) return <div className="empty">{empty}</div>;
  return (
    <div className="tbl-wrap"><table><tbody>
      <tr>{cols.map(([h]) => <th key={h}>{h}</th>)}</tr>
      {rows.map((r, i) => <tr key={i} onClick={onRow ? () => onRow(r) : undefined} style={onRow ? { cursor: "pointer" } : undefined}>{cols.map(([h, f]) => <td key={h}>{f(r)}</td>)}</tr>)}
    </tbody></table></div>
  );
}

export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: [K, string][]; value: K; onChange: (k: K) => void }) {
  return <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>{l}</button>)}</div>;
}

export function Pill({ children, tone }: { children: React.ReactNode; tone?: "bad" | "warn" | "grey" }) {
  return <span className={`pill ${tone ?? ""}`}>{children}</span>;
}

/** Submit a form as JSON. The handler gets the form fields as an object. */
export function JsonForm({ onSubmit, children, submit = "Save", reset = true }: { onSubmit: (v: Record<string, string>) => Promise<unknown>; children: React.ReactNode; submit?: string; reset?: boolean }) {
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="grid" style={{ gap: 12 }} onSubmit={async (e) => {
      e.preventDefault();
      const el = e.currentTarget;
      setBusy(true); setMsg(null);
      try { await onSubmit(Object.fromEntries(new FormData(el).entries()) as Record<string, string>); if (reset) el.reset(); setMsg({ ok: true, t: "Saved" }); }
      catch (er) { setMsg({ ok: false, t: (er as Error).message }); }
      setBusy(false);
    }}>
      {children}
      {msg && <div className={`notice ${msg.ok ? "info" : "bad"}`}>{msg.t}</div>}
      <div><button className="btn" type="submit" disabled={busy}>{busy ? "Saving..." : submit}</button></div>
    </form>
  );
}

export const fmtDate = (d?: string | Date | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Never");
export const fmtDateTime = (d?: string | Date | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
export const lakh = (pkr: number) => (pkr >= 10000000 ? `PKR ${(pkr / 10000000).toFixed(2)} crore` : pkr >= 100000 ? `PKR ${(pkr / 100000).toFixed(2)} lakh` : `PKR ${pkr.toLocaleString("en-PK")}`);

export async function download(path: string, filename: string) {
  const r = await fetch(path);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Download failed");
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
}

export async function upload<T>(path: string, form: FormData): Promise<T> {
  const r = await fetch(path, { method: "POST", body: form });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Upload failed");
  return d as T;
}
