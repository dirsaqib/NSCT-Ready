"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, SUBJECT_SHORT, fmtTime } from "@/components/api";
import { StatusTracker, SurveyWidget } from "@/components/StudentWidgets";

type Dash = {
  profile: { fullName: string; program: string; university: { name: string }; streakDays: number; points: number } | null;
  readiness: { score: number; tested: number };
  band: { label: string; level: string };
  mastery: { subject: string; correct: number; total: number }[];
  priorities: { key: string; short: string; weight: number; acc: number | null }[];
  attempts: { id: string; type: string; label: string | null; submittedAt: string; score: number; correct: number; total: number; startedAt: string }[];
  notices: { id: string; title: string; body: string; due: string | null; action: string | null }[];
  daysLeft: number;
  badges: { key: string; label: string; on: boolean }[];
};

const TYPE: Record<string, string> = { DIAGNOSTIC: "Diagnostic", MOCK: "Full mock", MINI_MOCK: "Mini mock", NATIONAL_MOCK: "National mock", PRACTICE: "Practice", MISTAKES: "Mistakes review" };

function Ring({ v }: { v: number }) {
  const r = 56, c = 2 * Math.PI * r;
  const color = v >= 60 ? "#0B6E4F" : v >= 45 ? "#E9A23B" : "#C2453A";
  return (
    <div className="ring">
      <svg width="132" height="132">
        <circle cx="66" cy="66" r={r} stroke="#EDF1EE" strokeWidth="12" fill="none" />
        <circle cx="66" cy="66" r={r} stroke={color} strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <div className="lbl"><div><b>{v}</b><span>out of 100</span></div></div>
    </div>
  );
}

export default function Dashboard() {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState("");
  const r = useRouter();
  useEffect(() => {
    api<Dash>("/api/me/dashboard").then((x) => (x.profile ? setD(x) : r.replace("/register"))).catch((e) => setErr(e.message));
  }, [r]);
  if (err) return <div className="notice bad">{err}</div>;
  if (!d || !d.profile) return <div className="spin" />;
  const m = Object.fromEntries(d.mastery.map((x) => [x.subject, x]));
  const hasDiag = d.attempts.some((a) => a.type === "DIAGNOSTIC");
  const pill = d.band.level === "risk" ? "bad" : d.band.level === "borderline" ? "warn" : "";
  return (
    <>
      <div className="top">
        <div><h1>Assalam o Alaikum, {d.profile.fullName.split(" ")[0]}</h1><p className="sub">{d.profile.university.name} · {d.profile.program}</p></div>
        <div className="row"><Link className="btn sec" href="/plan">My study plan</Link><Link className="btn" href="/mock">Start a mock test</Link></div>
      </div>
      <StatusTracker />
      <SurveyWidget />
      <div className="card hero" style={{ marginBottom: 16 }}>
        <div className="row between">
          <div><h2 style={{ color: "#fff", fontSize: 22, margin: 0 }}>{d.daysLeft} days to NSCT</h2><div className="muted small">23 and 24 January 2027</div></div>
          <div className="count">
            <div><b>{Math.floor(d.daysLeft / 7)}</b><span>weeks</span></div>
            <div><b>{d.profile.streakDays}</b><span>day streak</span></div>
            <div><b>{d.profile.points}</b><span>points</span></div>
          </div>
        </div>
      </div>
      {d.notices.map((n) => (
        <div className="notice info" key={n.id} style={{ marginBottom: 12 }}>
          <b>{n.title}</b>{n.due ? ` · due ${new Date(n.due).toLocaleDateString("en-GB")}` : ""}
          <div className="small">{n.body}</div>
          {n.action && <Link className="btn sm" style={{ marginTop: 8 }} href={`/${n.action}`}>Open</Link>}
        </div>
      ))}
      {!hasDiag && (
        <div className="card" style={{ marginBottom: 16, background: "var(--accent-soft)" }}>
          <div className="row between"><div><h2 style={{ margin: 0 }}>Start with the diagnostic test</h2><p className="muted" style={{ margin: "4px 0 0" }}>20 questions, 25 minutes, all 10 subjects.</p></div><Link className="btn acc" href="/diagnostic">Take diagnostic</Link></div>
        </div>
      )}
      <div className="grid g2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>Readiness</h2>
          <div className="row ringrow" style={{ gap: 22 }}>
            <Ring v={d.readiness.score} />
            <div>
              <span className={`pill ${pill}`}>{d.band.label}</span>
              <p className="tiny muted">Based on {d.readiness.tested} of 10 subjects. Estimate only, the official cut-off is not published.</p>
              <p className="small">Biggest gain available: <b>{d.priorities[0]?.short}</b> <Link href="/practice">Practise now</Link></p>
            </div>
          </div>
        </div>
        <div className="card">
          <h2>Subject mastery</h2>
          <div className="bars">
            {d.priorities.slice().sort((a, b) => b.weight - a.weight).map((s) => {
              const x = m[s.key];
              const p = x?.total ? Math.round((100 * x.correct) / x.total) : null;
              return (
                <div className="bar-row" key={s.key}>
                  <div><b>{s.short}</b> <span className="muted tiny">{s.weight}%</span></div>
                  <div className="bar"><i className={p == null ? "" : p >= 70 ? "" : p >= 50 ? "w" : "b"} style={{ width: `${p ?? 0}%` }} /></div>
                  <div className="small" style={{ textAlign: "right" }}>{p == null ? "n/a" : `${p}%`}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="grid g2">
        <div className="card">
          <h2>Recent tests</h2>
          {d.attempts.length ? (
            <table><tbody>
              <tr><th>Test</th><th>Date</th><th>Score</th><th>Time</th></tr>
              {d.attempts.slice(0, 6).map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/test/${a.id}`}>{TYPE[a.type]}</Link> {a.label && <span className="muted tiny">{SUBJECT_SHORT[a.label.split(" ")[0]] ?? a.label}</span>}</td>
                  <td>{new Date(a.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                  <td><b>{a.score}%</b> <span className="muted tiny">{a.correct}/{a.total}</span></td>
                  <td>{fmtTime((new Date(a.submittedAt).getTime() - new Date(a.startedAt).getTime()) / 1000)}</td>
                </tr>
              ))}
            </tbody></table>
          ) : <div className="empty">No tests yet.</div>}
        </div>
        <div className="card">
          <h2>Badges</h2>
          <div className="grid g3" style={{ gap: 10 }}>
            {d.badges.map((b) => <div key={b.key} className={`badge ${b.on ? "on" : ""}`}><div className="e">{b.on ? "✓" : "·"}</div>{b.label}</div>)}
          </div>
        </div>
      </div>
    </>
  );
}
