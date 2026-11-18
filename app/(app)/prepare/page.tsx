"use client";
import { useState } from "react";
import StartButton from "@/components/StartButton";
import { Page, useApi, Loading } from "@/components/ui";

type Level = { n: number; topic: string; questions: number; best: number | null; stars: number; unlocked: boolean };
type World = { key: string; name: string; short: string; weight: number; levels: Level[]; done: number; total: number; stars: number; boss: { unlocked: boolean; best: number | null; stars: number } };
type Prep = { xp: number; rank: string; nextRank: { name: string; at: number } | null; streak: number; played: number; worlds: World[] };

const Stars = ({ n }: { n: number }) => <span className="stars">{[1, 2, 3].map((i) => <span key={i} className={i <= n ? "" : "off"}>★</span>)}</span>;

/**
 * Preparation as a game: each NSCT subject is a world and each topic a level of 10 questions.
 * 60% earns a star and opens the next level, 80% two stars, 95% three. A subject boss opens after most levels.
 */
export default function Prepare() {
  const { data, error } = useApi<Prep>("/api/me/prepare");
  const [sel, setSel] = useState("PS");
  if (!data) return <Page title="Preparation"><Loading error={error} /></Page>;
  const w = data.worlds.find((x) => x.key === sel)!;
  const toNext = data.nextRank ? Math.round((100 * data.xp) / data.nextRank.at) : 100;
  return (
    <Page title="Preparation" sub="Play topic by topic. Score 60% to earn a star and open the next level. Aim for three stars everywhere.">
      <div className="card hero" style={{ marginBottom: 16 }}>
        <div className="row between">
          <div>
            <div className="muted small">Your rank</div>
            <h2 style={{ color: "#fff", margin: "2px 0" }}>{data.rank}</h2>
            <div className="small" style={{ color: "#BFE0D2" }}>{data.xp.toLocaleString()} XP{data.nextRank ? `, ${(data.nextRank.at - data.xp).toLocaleString()} to ${data.nextRank.name}` : ""}</div>
            <div style={{ height: 8, width: 240, background: "rgba(255,255,255,.2)", borderRadius: 9, marginTop: 8 }}><div style={{ height: 8, width: `${Math.min(100, toNext)}%`, background: "#E9A23B", borderRadius: 9 }} /></div>
          </div>
          <div className="count">
            <div><b>{data.streak}</b><span>day streak</span></div>
            <div><b>{data.worlds.reduce((n, x) => n + x.stars, 0)}</b><span>stars</span></div>
            <div><b>{data.played}</b><span>sessions</span></div>
          </div>
        </div>
      </div>

      <div className="worlds">
        {data.worlds.map((x) => (
          <button key={x.key} className={`world ${x.key === sel ? "on" : ""}`} onClick={() => setSel(x.key)}>
            <b className="small">{x.short}</b> <span className="tiny muted">{x.weight}%</span>
            <div className="tiny muted">{x.done} of {x.total} levels</div>
            <div className="meter"><i style={{ width: `${x.total ? (100 * x.done) / x.total : 0}%` }} /></div>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <div><h2 style={{ margin: 0 }}>{w.name}</h2><span className="small muted">{w.weight}% of the NSCT · {w.stars} of {w.total * 3} stars</span></div>
        </div>
        {w.levels.length === 0 ? <div className="empty">Levels for this subject are being added.</div> : (
          <div className="path">
            {w.levels.map((l) => (
              <div key={l.topic} className={`lvl ${l.unlocked ? "" : "locked"}`}>
                <div className="row between"><span className="num">{l.n}</span><Stars n={l.stars} /></div>
                <b className="small">{l.topic}</b>
                <span className="tiny muted">{l.best == null ? `${Math.min(10, l.questions)} questions` : `Best ${l.best}%`}</span>
                {l.unlocked
                  ? <StartButton type="PRACTICE" subject={w.key} topic={l.topic} count={10} label={l.best == null ? "Play" : l.stars === 3 ? "Play again" : "Improve"} className="btn sm" />
                  : <span className="tiny muted">Get a star on level {l.n - 1} to open</span>}
              </div>
            ))}
            <div className={`lvl boss ${w.boss.unlocked ? "" : "locked"}`}>
              <div className="row between"><span className="num">★</span><Stars n={w.boss.stars} /></div>
              <b className="small">{w.short} boss</b>
              <span className="tiny muted">{w.boss.best == null ? "12 mixed questions, 15 minutes" : `Best ${w.boss.best}%`}</span>
              {w.boss.unlocked
                ? <StartButton type="MINI_MOCK" subject={w.key} label="Fight the boss" className="btn sm acc" confirmText="Timed: 15 minutes. Start now?" />
                : <span className="tiny muted">Earn stars on most levels to open</span>}
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
