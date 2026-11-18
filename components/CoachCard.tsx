"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "./api";

type Advice = { headline: string; summary: string; focus: { title: string; why: string; action: string }[]; weekPlan: string[]; source: string };

/** The AI coach: what to work on next, built from the student's own results. */
export default function CoachCard({ compact = false }: { compact?: boolean }) {
  const [a, setA] = useState<Advice | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = (refresh = false) => {
    setBusy(true); setErr("");
    api<{ coach: Advice | null }>(`/api/me/coach${refresh ? "?refresh=1" : ""}`).then((x) => setA(x.coach)).catch((e) => setErr(e.message)).finally(() => setBusy(false));
  };
  useEffect(() => load(), []);
  if (err) return <div className="card" style={{ marginBottom: 16 }}><b>Your coach</b><p className="small muted">{err}</p></div>;
  if (!a) return <div className="card" style={{ marginBottom: 16 }}><b>Your coach</b><p className="small muted">Reading your results...</p></div>;
  return (
    <div className="card" style={{ marginBottom: 16, borderColor: "var(--brand)" }}>
      <div className="row between">
        <div><span className="tiny muted">Your AI coach</span><h2 style={{ margin: "2px 0" }}>{a.headline}</h2></div>
        <button className="btn ghost sm" disabled={busy} onClick={() => load(true)}>{busy ? "Updating" : "Refresh"}</button>
      </div>
      <p className="small" style={{ marginTop: 4 }}>{a.summary}</p>
      <div className={compact ? "grid" : "grid g3"} style={{ gap: 10 }}>
        {a.focus.map((f, i) => (
          <div key={i} className="card" style={{ background: "var(--soft, #f6f8f7)", boxShadow: "none" }}>
            <b className="small">{i + 1}. {f.title}</b>
            <p className="tiny muted" style={{ margin: "4px 0" }}>{f.why}</p>
            <p className="tiny" style={{ margin: 0 }}>{f.action}</p>
          </div>
        ))}
      </div>
      {!compact && (
        <>
          <h3 style={{ marginBottom: 4 }}>This week</h3>
          <ul className="small" style={{ marginTop: 0 }}>{a.weekPlan.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </>
      )}
      <div className="row"><Link className="btn sm" href="/practice">Practise now</Link><Link className="btn sm sec" href="/mistakes">My mistakes</Link><Link className="btn sm ghost" href="/tutor">Ask the tutor</Link></div>
    </div>
  );
}
