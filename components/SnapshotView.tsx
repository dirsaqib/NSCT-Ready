"use client";
import { ColChart, HBars, pct } from "./Charts";
import { SUBJECT_SHORT } from "./api";
import type { Snapshot } from "@/lib/reports";

type G = Snapshot["byProvince"];

function GroupTable({ title, rows, minGroup }: { title: string; rows: G; minGroup: number }) {
  return (
    <div className="card"><h2>{title}</h2>
      {rows.length ? <table><tbody>
        <tr><th>Group</th><th>Students</th><th>Active</th><th>Avg readiness</th></tr>
        {rows.map((g) => <tr key={g.group}><td>{g.group}</td><td>{g.students}</td><td>{g.active}</td><td><b>{g.avgReadiness ?? "n/a"}</b></td></tr>)}
      </tbody></table> : <div className="empty">No group has {minGroup} or more students yet.</div>}
    </div>
  );
}

export default function SnapshotView({ s, trend }: { s: Snapshot; trend?: { date: string; avg: number }[] }) {
  return (
    <>
      <div className="notice info" style={{ marginBottom: 16 }}>
        Anonymised report. Only students who gave research consent are counted. No names or contact details. Groups under <b>{s.minGroup}</b> students are not shown{s.hiddenGroups ? ` (${s.hiddenGroups} hidden)` : ""}. Platform estimates, not official NSCT results.
      </div>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card stat"><div className="k">Students</div><div className="v">{s.students}</div><div className="d">{s.universities} universities</div></div>
        <div className="card stat"><div className="k">Active</div><div className="v">{s.active}</div><div className="d">{pct(s.active, s.students)}% took a test</div></div>
        <div className="card stat"><div className="k">Avg readiness</div><div className="v">{s.avgReadiness ?? "n/a"}</div><div className="d">out of 100</div></div>
        <div className="card stat"><div className="k">Mock tests</div><div className="v">{s.mocks}</div><div className="d">avg score {s.avgMockScore ?? "n/a"}%</div></div>
      </div>
      {trend && trend.length >= 2 && (
        <div className="card" style={{ marginBottom: 16 }}><h2>National average readiness over time</h2><ColChart values={trend.map((t) => t.avg)} labels={trend.map((t) => t.date)} every={1} /></div>
      )}
      <div className="grid g2" style={{ marginBottom: 16 }}>
        <div className="card"><h2>Skill level by subject</h2><HBars max={100} grade rows={s.subjects.map((x) => ({ label: x.subject, sub: `${x.weight}%`, v: x.accuracy ?? 0, text: x.accuracy == null ? "n/a" : `${x.accuracy}%` }))} /></div>
        <div className="card"><h2>Biggest skill gaps</h2>
          <table><tbody><tr><th>Subject</th><th>Topic</th><th>Accuracy</th></tr>
            {s.weakestTopics.map((t) => <tr key={t.subject + t.topic}><td>{SUBJECT_SHORT[t.subject]}</td><td>{t.topic}</td><td><b style={{ color: "var(--bad)" }}>{t.accuracy}%</b></td></tr>)}
          </tbody></table>
        </div>
      </div>
      {s.readinessBins && s.bands && (
        <div className="grid g2" style={{ marginBottom: 16 }}>
          <div className="card"><h2>Readiness distribution</h2><ColChart values={s.readinessBins} labels={s.readinessBins.map((_, i) => `${i * 10}-${i * 10 + 10}`)} every={1} /></div>
          <div className="card"><h2>Predicted bands</h2><HBars max={Math.max(1, s.active)} rows={[["Top performer range", s.bands.top], ["Likely to qualify", s.bands.qualify], ["Borderline", s.bands.borderline], ["At risk", s.bands.risk]].map(([l, v]) => ({ label: String(l), v: Number(v), text: `${v} (${pct(Number(v), s.active)}%)` }))} /></div>
        </div>
      )}
      <div className="grid g2" style={{ marginBottom: 16 }}><GroupTable title="By province" rows={s.byProvince} minGroup={s.minGroup} /><GroupTable title="By program" rows={s.byProgram} minGroup={s.minGroup} /></div>
      <div className="grid g2"><GroupTable title="By semester" rows={s.bySemester} minGroup={s.minGroup} /><GroupTable title="By university" rows={s.byUniversity} minGroup={s.minGroup} /></div>
    </>
  );
}
