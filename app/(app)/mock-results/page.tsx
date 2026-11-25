"use client";
import { useState } from "react";
import { Page, Card, Stat, useApi, Loading, Table, Pill, Tabs, fmtDateTime, download } from "@/components/ui";

type Sec = { key: string; name: string; weight: number; total: number; correct: number; wrong: number; skipped: number; pct: number };
type Detail = {
  attemptId: string; label: string; submittedAt: string; minutes: number; score: number; total: number; correct: number; wrong: number; skipped: number; autoSubmitted: string | null;
  student: { fullName: string; rollNumber: string; program: string; semester: string; section: string | null; university: string; department: string | null };
  sections: Sec[]; weakTopics: { topic: string; subject: string; wrong: number; total: number }[];
  questions: { n: number; subject: string; topic: string; status: "correct" | "wrong" | "skipped"; timeSec: number }[];
};
type Row = { attemptId: string; label: string; score: number; submittedAt: string; minutes: number; autoSubmitted: boolean; fullName: string; rollNumber: string; program: string; semester: string; section: string | null; department: string | null; correct: number; wrong: number; skipped: number; total: number; sections: Record<string, { c: number; w: number; s: number; t: number }> };

const SUBJ: [string, string][] = [["PS", "PS"], ["PROG", "Prog"], ["DSA", "DSA"], ["DB", "DB"], ["SE", "SE"], ["WEB", "Web"], ["AI", "AI"], ["NET", "Net"], ["OS", "OS"], ["SEC", "Sec"]];
const tone = (p: number) => (p >= 70 ? "#0B7A5E" : p >= 50 ? "#8A5A0B" : "#B3372D");
const bg = (p: number) => (p >= 70 ? "#D9F3E8" : p >= 50 ? "#FFF1D6" : "#FBE0DC");

/** Mock test results: section-wise right, wrong and skipped, on the web, as PDF and as Excel. */
export default function MockResults() {
  const [label, setLabel] = useState("");
  const [q, setQ] = useState(() => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") ?? "" : ""));
  const { data, error } = useApi<{ rows: Row[]; staff: boolean }>(`/api/results?label=${encodeURIComponent(label)}&q=${encodeURIComponent(q)}`, [label, q]);
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <ResultDetail id={open} back={() => setOpen(null)} />;
  return (
    <Page title="Mock test results" sub={data?.staff ? "Every mock result of your students, section by section. Open one for the full detail, or download." : "Your mock tests, section by section. Open one for the full detail, or download it."}
      actions={data?.staff && <button className="btn sec" onClick={() => download(`/api/results?format=xlsx&label=${encodeURIComponent(label)}&q=${encodeURIComponent(q)}`, "mock-results.xlsx")}>Download all (Excel)</button>}>
      <div className="card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16, padding: 12 }}>
        <Tabs value={label} onChange={setLabel} tabs={[["", "All mocks"], ["Mock 1", "Mock 1"], ["Mock 2", "Mock 2"], ["Mock 3", "Mock 3"]]} />
        {data?.staff && <input placeholder="Search name or roll number" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginLeft: "auto", minWidth: 240 }} />}
      </div>
      {!data ? <Loading error={error} /> : !data.rows.length ? <Card><div className="empty">No mock results yet. {data.staff ? "Results appear here as soon as students submit a mock test." : "Take Mock 1 from the Mock tests page."}</div></Card> : (
        <Card>
          <div className="tbl-wrap">
            <table>
              <thead><tr>{data.staff && <th>Student</th>}<th>Test</th><th>Date</th><th>Score</th><th>Correct</th><th>Wrong</th><th>Skipped</th>{SUBJ.map(([k, l]) => <th key={k} style={{ textAlign: "center" }}>{l}</th>)}<th></th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.attemptId}>
                    {data.staff && <td><b>{r.fullName}</b><div className="tiny muted">{r.rollNumber} · {r.program} {r.semester}{r.section ?? ""}{r.department ? ` · ${r.department}` : ""}</div></td>}
                    <td><b>{r.label}</b>{r.autoSubmitted && <div className="tiny" style={{ color: "#B3372D" }}>auto-submitted</div>}</td>
                    <td className="tiny">{fmtDateTime(r.submittedAt)}</td>
                    <td><span style={{ background: bg(r.score), color: tone(r.score), padding: "3px 10px", borderRadius: 8, fontWeight: 800 }}>{r.score}%</span></td>
                    <td style={{ color: "#0B7A5E", fontWeight: 700 }}>{r.correct}</td><td style={{ color: "#B3372D", fontWeight: 700 }}>{r.wrong}</td><td className="muted">{r.skipped}</td>
                    {SUBJ.map(([k]) => { const s = r.sections[k]; const p = s ? Math.round((100 * s.c) / s.t) : null; return <td key={k} style={{ textAlign: "center", padding: 4 }}>{s ? <span title={`${s.c} right, ${s.w} wrong, ${s.s} skipped`} style={{ display: "inline-block", minWidth: 40, padding: "3px 4px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: bg(p!), color: tone(p!) }}>{s.c}/{s.t}</span> : "–"}</td>; })}
                    <td><div className="row" style={{ flexWrap: "nowrap" }}>
                      <button className="btn sm" onClick={() => setOpen(r.attemptId)}>Details</button>
                      <button className="btn sm sec" onClick={() => download(`/api/results/${r.attemptId}?format=pdf`, `${r.label}-${r.rollNumber}.pdf`)}>PDF</button>
                      <button className="btn sm sec" onClick={() => download(`/api/results/${r.attemptId}?format=xlsx`, `${r.label}-${r.rollNumber}.xlsx`)}>Excel</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted">Each subject shows right answers out of questions asked. Hover for wrong and skipped.</p>
        </Card>
      )}
    </Page>
  );
}

function ResultDetail({ id, back }: { id: string; back: () => void }) {
  const { data: d, error } = useApi<Detail>(`/api/results/${id}`, [id]);
  if (!d) return <Loading error={error} />;
  return (
    <Page title={`${d.label} result`} sub={`${d.student.fullName} · ${d.student.rollNumber} · ${d.student.program} ${d.student.semester}${d.student.section ?? ""} · ${fmtDateTime(d.submittedAt)} · ${d.minutes} minutes`}
      actions={<div className="row">
        <button className="btn sec" onClick={back}>← All results</button>
        <button className="btn" onClick={() => download(`/api/results/${id}?format=pdf`, `${d.label}-${d.student.rollNumber}.pdf`)}>Download PDF</button>
        <button className="btn sec" onClick={() => download(`/api/results/${id}?format=xlsx`, `${d.label}-${d.student.rollNumber}.xlsx`)}>Download Excel</button>
      </div>}>
      {d.autoSubmitted && <div className="notice warn" style={{ marginBottom: 12 }}>This test was submitted automatically ({d.autoSubmitted}). Only the questions answered before that were marked.</div>}
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat k="Score" v={<span style={{ color: tone(d.score) }}>{d.score}%</span>} d={`${d.correct} of ${d.total} correct`} />
        <Stat k="Correct" v={<span style={{ color: "#0B7A5E" }}>{d.correct}</span>} />
        <Stat k="Wrong" v={<span style={{ color: "#B3372D" }}>{d.wrong}</span>} />
        <Stat k="Skipped" v={<span style={{ color: "#8A5A0B" }}>{d.skipped}</span>} />
      </div>
      <Card title="Section-wise result" style={{ marginBottom: 16 }}>
        <Table rows={d.sections} cols={[
          ["Section", (s) => <><b>{s.name}</b><div className="tiny muted">NSCT weight {s.weight}%</div></>],
          ["Questions", (s) => s.total],
          ["Correct", (s) => <b style={{ color: "#0B7A5E" }}>{s.correct}</b>],
          ["Wrong", (s) => <b style={{ color: "#B3372D" }}>{s.wrong}</b>],
          ["Skipped", (s) => <span className="muted">{s.skipped}</span>],
          ["Score", (s) => <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160 }}><div style={{ flex: 1, height: 10, background: "#EDF1F7", borderRadius: 99 }}><div style={{ width: `${s.pct}%`, height: "100%", borderRadius: 99, background: tone(s.pct) }} /></div><b style={{ color: tone(s.pct) }}>{s.pct}%</b></div>],
        ]} />
      </Card>
      <div className="grid g2">
        <Card title="Topics to revise">
          {!d.weakTopics.length ? <div className="empty">No mistakes. Excellent work.</div> : <Table rows={d.weakTopics} cols={[["Topic", (t) => <><b>{t.topic}</b><div className="tiny muted">{t.subject}</div></>], ["Missed", (t) => <Pill tone="bad">{t.wrong} of {t.total}</Pill>]]} />}
        </Card>
        <Card title="Question by question">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(54px,1fr))", gap: 6 }}>
            {d.questions.map((x) => <span key={x.n} title={`${x.topic} · ${x.timeSec}s`} style={{ textAlign: "center", padding: "6px 2px", borderRadius: 8, fontSize: 11, fontWeight: 700, color: "#fff", background: x.status === "correct" ? "#13A384" : x.status === "wrong" ? "#C2453A" : "#B9C2D3" }}>{x.n}<div style={{ fontWeight: 500, fontSize: 9.5 }}>{x.subject}</div></span>)}
          </div>
          <p className="tiny muted">Green correct, red wrong, grey skipped. <a href={`/test/${d.attemptId}`}>Open the full review with answers →</a></p>
        </Card>
      </div>
    </Page>
  );
}
