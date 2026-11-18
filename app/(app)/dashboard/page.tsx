"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/api";
import { StatusTracker } from "@/components/StudentWidgets";
import CoachCard from "@/components/CoachCard";

type Dash = { profile: { fullName: string; program: string; university: { name: string } } | null; daysLeft: number; readiness: { score: number } };
type Prep = { xp: number; rank: string; worlds: { done: number; total: number; stars: number }[] };
type Mocks = { mocks: { n: number; unlocked: boolean; best: number | null }[]; latest: { score: number } | null };

/** Student home: three clear paths (preparation, mock tests, study materials) and the coach's advice. Nothing else. */
export default function Dashboard() {
  const r = useRouter();
  const [d, setD] = useState<Dash | null>(null);
  const [prep, setPrep] = useState<Prep | null>(null);
  const [mk, setMk] = useState<Mocks | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<Dash>("/api/me/dashboard").then((x) => (x.profile ? setD(x) : r.replace("/register"))).catch((e) => setErr(e.message));
    api<Prep>("/api/me/prepare").then(setPrep).catch(() => {});
    api<Mocks>("/api/me/mocks").then(setMk).catch(() => {});
  }, [r]);
  if (err) return <div className="notice bad">{err}</div>;
  if (!d?.profile) return <div className="spin" />;

  const levels = prep ? prep.worlds.reduce((n, w) => n + w.done, 0) : 0;
  const allLevels = prep ? prep.worlds.reduce((n, w) => n + w.total, 0) : 0;
  const nextMock = mk?.mocks.find((m) => m.unlocked && m.best == null) ?? mk?.mocks.filter((m) => m.unlocked).slice(-1)[0];
  const bestMock = mk ? Math.max(0, ...mk.mocks.map((m) => m.best ?? 0)) : 0;

  return (
    <>
      <div className="top">
        <div><h1>Assalam o Alaikum, {d.profile.fullName.split(" ")[0]}</h1><p className="sub">{d.daysLeft} days to NSCT · {d.profile.university.name}</p></div>
      </div>
      <StatusTracker />

      <div className="big3">
        <Link href="/prepare" className="card">
          <div className="ico">🎯</div>
          <h2 style={{ margin: 0 }}>Preparation</h2>
          <p className="small muted" style={{ margin: 0 }}>Play topic levels, earn stars and XP.</p>
          <p className="small" style={{ margin: "6px 0 0" }}>{prep ? <><b>{prep.rank}</b> · {prep.xp.toLocaleString()} XP · {levels} of {allLevels} levels</> : "Loading..."}</p>
          <span className="btn sm" style={{ alignSelf: "flex-start", marginTop: 6 }}>{levels ? "Continue" : "Start level 1"}</span>
        </Link>
        <Link href="/mock" className="card">
          <div className="ico" style={{ background: "var(--accent-soft)" }}>📝</div>
          <h2 style={{ margin: 0 }}>Mock tests</h2>
          <p className="small muted" style={{ margin: 0 }}>Mock 1, 2 and 3, full NSCT papers.</p>
          <p className="small" style={{ margin: "6px 0 0" }}>{mk ? (bestMock ? <>Best score <b>{bestMock}%</b> · target 90%</> : "No mock taken yet") : "Loading..."}</p>
          <span className="btn sm sec" style={{ alignSelf: "flex-start", marginTop: 6 }}>{nextMock ? (nextMock.best == null ? `Take Mock ${nextMock.n}` : "Open mocks") : "Open mocks"}</span>
        </Link>
        <Link href="/learn" className="card">
          <div className="ico" style={{ background: "#E8F0FB" }}>🎬</div>
          <h2 style={{ margin: 0 }}>Study materials</h2>
          <p className="small muted" style={{ margin: 0 }}>Harvard, MIT and top lectures, plus notes.</p>
          <p className="small" style={{ margin: "6px 0 0" }}>All 10 NSCT subjects</p>
          <span className="btn sm sec" style={{ alignSelf: "flex-start", marginTop: 6 }}>Watch and read</span>
        </Link>
      </div>

      <CoachCard />
    </>
  );
}
