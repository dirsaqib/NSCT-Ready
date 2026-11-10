"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "./api";
import { useApi } from "./ui";

/** Pending > Verified > Active, shown until the student is active. */
export function StatusTracker() {
  const { data } = useApi<{ account: { status: string; proUntil: string | null }; profile: { rejectReason: string | null } | null }>("/api/profile");
  if (!data?.account || data.account.status === "ACTIVE") return null;
  const steps = ["PENDING", "VERIFIED", "ACTIVE"];
  const at = steps.indexOf(data.account.status);
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 0 }}>
        {["Registered, waiting for your university", "Verified by your university", "Active"].map((l, i) => (
          <div key={l} style={{ flex: 1, padding: "8px 10px", borderBottom: `4px solid ${i <= at ? "var(--brand)" : "var(--line)"}` }}>
            <div className="tiny muted">Step {i + 1}</div><b className="small">{l}</b>
          </div>
        ))}
      </div>
      {data.account.status === "PENDING" && <p className="small" style={{ marginBottom: 0 }}>Your focal person checks your roll number. You can use the diagnostic and practice now. Mock tests open after verification.</p>}
      {data.profile?.rejectReason && <p className="small" style={{ color: "var(--bad)", marginBottom: 0 }}>Please correct your details: {data.profile.rejectReason} <Link href="/profile">Edit profile</Link></p>}
    </div>
  );
}

type Survey = { id: string; title: string; questions: { q: string; type: "scale" | "text" }[] };

export function SurveyWidget() {
  const { data, reload } = useApi<{ surveys: Survey[] }>("/api/surveys");
  const [ans, setAns] = useState<(number | string)[]>([]);
  const s = data?.surveys?.[0];
  if (!s) return null;
  return (
    <div className="card" style={{ marginBottom: 16, background: "var(--accent-soft)" }}>
      <h2>{s.title}</h2>
      {s.questions.map((q, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div className="small"><b>{q.q}</b></div>
          {q.type === "scale" ? (
            <div className="row">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={`btn sm ${ans[i] === n ? "" : "sec"}`} onClick={() => { const a = [...ans]; a[i] = n; setAns(a); }}>{n}</button>)}<span className="tiny muted">1 poor, 5 excellent</span></div>
          ) : (
            <input type="text" value={String(ans[i] ?? "")} onChange={(e) => { const a = [...ans]; a[i] = e.target.value; setAns(a); }} />
          )}
        </div>
      ))}
      <button className="btn sm" onClick={async () => { await api("/api/surveys", { body: { kind: "answer", surveyId: s.id, answers: s.questions.map((q, i) => ans[i] ?? (q.type === "scale" ? 3 : "")) } }); setAns([]); reload(); }}>Send feedback</button>
    </div>
  );
}
