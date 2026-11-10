"use client";
import { useEffect, useState } from "react";
import { api, SUBJECT_SHORT } from "@/components/api";

type G = { group: string; students: number; avgReadiness: number };
type R = {
  generatedAt: string; minGroupSize: number; students: number;
  subjects: { subject: string; weight: number; accuracy: number | null }[];
  weakestTopics: { subject: string; topic: string; accuracy: number }[];
  byProvince: G[]; byProgram: G[];
};

function GroupTable({ title, rows }: { title: string; rows: G[] }) {
  return (
    <div className="card"><h2>{title}</h2><table><tbody>
      <tr><th>Group</th><th>Students</th><th>Avg readiness</th></tr>
      {rows.map((g) => <tr key={g.group}><td>{g.group}</td><td>{g.students}</td><td><b>{g.avgReadiness}</b></td></tr>)}
    </tbody></table></div>
  );
}

export default function NationalReport() {
  const [r, setR] = useState<R | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<R>("/api/reports/national").then(setR).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="notice bad">{err}</div>;
  if (!r) return <div className="spin" />;
  return (
    <>
      <div className="top">
        <div><h1>National Computing Skills Report</h1><p className="sub">{r.students} consenting students · anonymised · no group under {r.minGroupSize} students shown</p></div>
        <button className="btn sec" onClick={() => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: "application/json" }));
          const a = document.createElement("a"); a.href = url; a.download = "national-skills-report.json"; a.click();
        }}>Download data</button>
      </div>
      <div className="grid g2" style={{ marginBottom: 16 }}>
        <div className="card"><h2>Accuracy by subject</h2><table><tbody>
          <tr><th>Subject</th><th>Weight</th><th>Accuracy</th></tr>
          {r.subjects.map((s) => <tr key={s.subject}><td>{s.subject}</td><td>{s.weight}%</td><td><b>{s.accuracy == null ? "n/a" : `${s.accuracy}%`}</b></td></tr>)}
        </tbody></table></div>
        <div className="card"><h2>Weakest topics nationally</h2><table><tbody>
          <tr><th>Topic</th><th>Accuracy</th></tr>
          {r.weakestTopics.map((t) => <tr key={t.subject + t.topic}><td><span className="pill grey">{SUBJECT_SHORT[t.subject]}</span> {t.topic}</td><td><b>{t.accuracy}%</b></td></tr>)}
        </tbody></table></div>
      </div>
      <div className="grid g2">
        <GroupTable title="By province" rows={r.byProvince} />
        <GroupTable title="By program" rows={r.byProgram} />
      </div>
    </>
  );
}
