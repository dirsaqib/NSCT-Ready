"use client";
import { useState } from "react";
import StartButton from "@/components/StartButton";
import { SUBJECTS } from "@/lib/syllabus";

export default function Practice() {
  const [topics, setTopics] = useState<Record<string, string>>({});
  const [level, setLevel] = useState<Record<string, number | undefined>>({});
  return (
    <>
      <div className="top"><div><h1>Topic practice</h1><p className="sub">Untimed. Choose a topic and difficulty. See the answer after every question.</p></div></div>
      <div className="grid g2">
        {SUBJECTS.map((s) => (
          <div className="card" key={s.key}>
            <div className="row between"><h3 style={{ margin: 0 }}>{s.name}</h3><span className="pill grey">{s.weight}%</span></div>
            <div className="row" style={{ marginTop: 12 }}>
              <input type="text" placeholder="Topic (optional)" value={topics[s.key] ?? ""} onChange={(e) => setTopics({ ...topics, [s.key]: e.target.value })} style={{ flex: 1, minWidth: 140 }} />
              <select value={level[s.key] ?? ""} onChange={(e) => setLevel({ ...level, [s.key]: e.target.value ? Number(e.target.value) : undefined })} style={{ width: "auto" }}>
                <option value="">Any level</option><option value="1">Easy</option><option value="2">Medium</option><option value="3">Hard</option>
              </select>
              <StartButton type="PRACTICE" subject={s.key} topic={topics[s.key]} difficulty={level[s.key]} label="Practise 10" className="btn sm" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
