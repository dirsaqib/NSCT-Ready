"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/api";

type D = { students: { alias: string; university: string; best: number }[]; universities: { university: string; students: number; avgBest: number }[] };

export default function Leaderboard() {
  const [d, setD] = useState<D | null>(null);
  useEffect(() => { api<D>("/api/leaderboard").then(setD); }, []);
  if (!d) return <div className="spin" />;
  return (
    <>
      <div className="top"><div><h1>Leaderboard</h1><p className="sub">Best full mock scores from students who chose to join. Universities need at least 5 students to appear.</p></div></div>
      <div className="grid g2">
        <div className="card"><h2>Top students</h2><table><tbody>
          <tr><th>#</th><th>Student</th><th>University</th><th>Best</th></tr>
          {d.students.map((s, i) => <tr key={i}><td>{i + 1}</td><td><b>{s.alias}</b></td><td className="small">{s.university}</td><td><b>{s.best}%</b></td></tr>)}
        </tbody></table></div>
        <div className="card"><h2>University vs university</h2><table><tbody>
          <tr><th>University</th><th>Students</th><th>Avg best</th></tr>
          {d.universities.map((u) => <tr key={u.university}><td className="small">{u.university}</td><td>{u.students}</td><td><b>{u.avgBest}%</b></td></tr>)}
        </tbody></table></div>
      </div>
    </>
  );
}
