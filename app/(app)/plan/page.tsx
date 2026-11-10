"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/api";

type D = { daysLeft: number; plan: { from: string; to: string; title: string; tasks: string[] }[]; priorities: { key: string; short: string }[] };
const fmt = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function Plan() {
  const [d, setD] = useState<D | null>(null);
  useEffect(() => { api<D>("/api/me/dashboard").then(setD); }, []);
  if (!d) return <div className="spin" />;
  return (
    <>
      <div className="top"><div><h1>Your study plan</h1><p className="sub">{d.plan.length} weeks to NSCT · {d.daysLeft} days left. Updates after every test.</p></div></div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Priority order</h2>
        <div className="row">{d.priorities.map((p, i) => <span key={p.key} className={`pill ${i < 3 ? "warn" : "grey"}`}>{i + 1}. {p.short}</span>)}</div>
      </div>
      <div className="grid g2">
        {d.plan.map((w, i) => (
          <div key={i} className={`week ${i === 0 ? "now" : ""}`}>
            <b>Week {i + 1}: {w.title}</b>
            <div className="tiny muted">{fmt(w.from)} to {fmt(w.to)}</div>
            <ul>{w.tasks.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        ))}
      </div>
    </>
  );
}
