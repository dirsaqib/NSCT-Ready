"use client";
import { useMemo, useState } from "react";
import { Page, Card, Stat, useApi, Loading, Table, Tabs, Pill, fmtDate, download } from "@/components/ui";

type Subj = { key: string; name: string; short: string; weight: number; accuracy: number | null; national: number | null; gap: number | null; answers: number; impact: number | null };
type Topic = { subject: string; subjectName: string; topic: string; students: number; answers: number; accuracy: number; national: number | null };
type Group = { group: string; registered: number; started: number; readiness: number | null; ready: number; atRisk: number; weakSubject: string | null };
type Stu = { userId: string; fullName: string; rollNumber: string; program: string; semester: string; section: string | null; department: string | null; readiness: number; bestMock: number; mocksDone: number; lastActive: string | null; daysIdle: number | null; weakSubject: string | null; weakScore: number | null; subjects: Record<string, number | null>; reasons: string[]; started: boolean };
type D = {
  scope: "department" | "campus" | "university";
  filters: { departments: { id: string; name: string }[]; programs: string[]; semesters: string[]; sections: string[] };
  kpi: { registered: number; started: number; notStarted: number; avgReadiness: number | null; nationalReadiness: number; ready: number; atRisk: number; active7: number; flagged: number };
  advice: { level: "high" | "medium" | "good"; title: string; detail: string }[];
  subjects: Subj[]; topics: Topic[]; buckets: { label: string; count: number }[];
  weeks: { label: string; active: number; tests: number; mockAvg: number | null }[];
  mockProgress: { n: number; students: number; avgBest: number | null }[];
  byDepartment: Group[]; byProgram: Group[]; bySemester: Group[]; bySection: Group[];
  attention: Stu[]; top: Stu[]; students: Stu[];
};

const tone = (v: number | null) => (v == null ? "#EEF1F6" : v >= 70 ? "#D9F3E8" : v >= 50 ? "#FFF1D6" : "#FBE0DC");
const ink = (v: number | null) => (v == null ? "var(--muted)" : v >= 70 ? "#0B7A5E" : v >= 50 ? "#8A5A0B" : "#B3372D");
const SUBJ = ["PS", "PROG", "DSA", "DB", "SE", "WEB", "AI", "NET", "OS", "SEC"];

function Bars({ rows }: { rows: { label: string; value: number | null; ref?: number | null; note?: string }[] }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "grid", gridTemplateColumns: "minmax(110px,170px) 1fr 92px", gap: 10, alignItems: "center", fontSize: 13 }}>
          <span>{r.label}</span>
          <div style={{ position: "relative", height: 12, background: "#EDF1F7", borderRadius: 99 }}>
            <div style={{ width: `${r.value ?? 0}%`, height: "100%", borderRadius: 99, background: r.value == null ? "transparent" : r.value >= 70 ? "linear-gradient(90deg,#13A384,#3DD68C)" : r.value >= 50 ? "linear-gradient(90deg,#F5A623,#FFC845)" : "linear-gradient(90deg,#C2453A,#E8705F)" }} />
            {r.ref != null && <div title={`National ${r.ref}%`} style={{ position: "absolute", left: `${r.ref}%`, top: -4, width: 3, height: 20, borderRadius: 2, background: "#14213D" }} />}
          </div>
          <span style={{ textAlign: "right" }}><b style={{ color: ink(r.value) }}>{r.value == null ? "n/a" : `${r.value}%`}</b>{r.note && <span className="small muted"> {r.note}</span>}</span>
        </div>
      ))}
    </div>
  );
}

function csv(rows: Stu[]) {
  const head = ["Name", "Roll", "Department", "Program", "Semester", "Section", "Readiness", "Best mock", "Mocks done", "Last active", "Weakest subject", ...SUBJ, "Needs attention because"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [head.map(esc).join(","), ...rows.map((s) => [s.fullName, s.rollNumber, s.department, s.program, s.semester, s.section, s.readiness, s.bestMock, s.mocksDone, s.lastActive ? fmtDate(s.lastActive) : "", s.weakSubject, ...SUBJ.map((k) => s.subjects[k] ?? ""), s.reasons.join("; ")].map(esc).join(","))];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a"); a.href = url; a.download = "student-insights.csv"; a.click(); URL.revokeObjectURL(url);
}

/** Detailed readiness insights so HODs and focal persons can see weak areas and advise students. */
export default function Insights() {
  const [f, setF] = useState({ department: "", program: "", semester: "", section: "" });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { data: d, error } = useApi<D>(`/api/insights${qs ? `?${qs}` : ""}`, [qs]);
  const [tab, setTab] = useState<"overview" | "topics" | "groups" | "students">("overview");
  const [find, setFind] = useState("");
  const [only, setOnly] = useState<"attention" | "all" | "top">("attention");
  const list = useMemo(() => {
    if (!d) return [];
    const base = only === "attention" ? d.attention : only === "top" ? d.top : d.students;
    const k = find.trim().toLowerCase();
    return k ? base.filter((s) => s.fullName.toLowerCase().includes(k) || s.rollNumber.toLowerCase().includes(k)) : base;
  }, [d, only, find]);

  const sel = (key: keyof typeof f, label: string, opts: { v: string; l: string }[]) => opts.length > 0 && (
    <label className="f" style={{ minWidth: 150 }}>{label}
      <select value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}><option value="">All</option>{opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
    </label>
  );

  return (
    <Page title="Readiness insights" sub="Where your students stand, what is weak, and what to do next. Updated live from every test and practice session."
      actions={d && <button className="btn sec" onClick={() => csv(d.students)}>Download all (Excel CSV)</button>}>
      {d && (
        <div className="card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16, padding: 14 }}>
          {sel("department", "Department", d.filters.departments.map((x) => ({ v: x.id, l: x.name })))}
          {sel("program", "Program", d.filters.programs.map((x) => ({ v: x, l: x })))}
          {sel("semester", "Semester", d.filters.semesters.map((x) => ({ v: x, l: x })))}
          {sel("section", "Section", d.filters.sections.map((x) => ({ v: x, l: x })))}
          {qs && <button className="btn sec sm" onClick={() => setF({ department: "", program: "", semester: "", section: "" })}>Clear filters</button>}
        </div>
      )}
      {!d ? <Loading error={error} /> : (
        <>
          <div className="grid g4" style={{ marginBottom: 16 }}>
            <Stat k="Average readiness" v={d.kpi.avgReadiness ?? "n/a"} d={<>National {d.kpi.nationalReadiness} {d.kpi.avgReadiness != null && <b style={{ color: d.kpi.avgReadiness >= d.kpi.nationalReadiness ? "#0B7A5E" : "#B3372D" }}>{d.kpi.avgReadiness >= d.kpi.nationalReadiness ? "▲" : "▼"} {Math.abs(d.kpi.avgReadiness - d.kpi.nationalReadiness)}</b>}</>} />
            <Stat k="Ready for NSCT" v={d.kpi.ready} d={`readiness 70+ · ${d.kpi.started ? Math.round((100 * d.kpi.ready) / d.kpi.started) : 0}% of active`} />
            <Stat k="Need support" v={<span style={{ color: d.kpi.atRisk ? "#B3372D" : undefined }}>{d.kpi.atRisk}</span>} d="readiness below 45" />
            <Stat k="Not started" v={<span style={{ color: d.kpi.notStarted ? "#8A5A0B" : undefined }}>{d.kpi.notStarted}</span>} d={`of ${d.kpi.registered} registered · ${d.kpi.active7} active this week`} />
          </div>

          <Tabs value={tab} onChange={setTab} tabs={[["overview", "Overview and advice"], ["topics", "Weak topics"], ["groups", "Compare groups"], ["students", `Students (${d.attention.length} need attention)`]]} />

          {tab === "overview" && (
            <>
              <Card title="What to do next" style={{ marginBottom: 16 }}>
                <div style={{ display: "grid", gap: 10 }}>
                  {d.advice.map((a, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, padding: 12, borderRadius: 12, background: a.level === "high" ? "#FDECEA" : a.level === "medium" ? "#FFF6E3" : "#E6F7F0", borderLeft: `4px solid ${a.level === "high" ? "#C2453A" : a.level === "medium" ? "#F5A623" : "#13A384"}` }}>
                      <span style={{ fontSize: 20 }}>{a.level === "high" ? "🔴" : a.level === "medium" ? "🟠" : "🟢"}</span>
                      <div><b>{a.title}</b><div className="small" style={{ marginTop: 2 }}>{a.detail}</div></div>
                    </div>
                  ))}
                </div>
              </Card>
              <div className="grid g2" style={{ marginBottom: 16 }}>
                <Card title="Subject accuracy" right={<span className="small muted">▍ marks the national average</span>}>
                  <Bars rows={d.subjects.map((s) => ({ label: `${s.short} (${s.weight}%)`, value: s.accuracy, ref: s.national, note: s.gap != null ? `${s.gap >= 0 ? "+" : ""}${s.gap}` : undefined }))} />
                </Card>
                <Card title="Where marks are being lost" right={<span className="small muted">weight × errors</span>}>
                  <Table rows={d.subjects.filter((s) => s.impact != null).sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0)).slice(0, 6)} cols={[
                    ["Subject", (s) => <b>{s.short}</b>], ["Accuracy", (s) => `${s.accuracy}%`], ["NSCT weight", (s) => `${s.weight}%`],
                    ["Marks lost of 100", (s) => <Pill tone={(s.impact ?? 0) >= 6 ? "bad" : (s.impact ?? 0) >= 4 ? "warn" : undefined}>about {s.impact}</Pill>],
                  ]} />
                </Card>
              </div>
              <div className="grid g3">
                <Card title="Readiness spread">
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 150 }}>
                    {d.buckets.map((b) => { const max = Math.max(1, ...d.buckets.map((x) => x.count)); return (
                      <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <span className="small"><b>{b.count}</b></span>
                        <div style={{ width: "75%", height: Math.max(4, (b.count / max) * 110), borderRadius: "8px 8px 0 0", background: b.label.startsWith("0") || b.label.startsWith("30") ? "#E8705F" : b.label.startsWith("45") ? "#F5A623" : "linear-gradient(180deg,#1D55CC,#13A384)" }} />
                        <span className="small muted">{b.label}</span>
                      </div>); })}
                  </div>
                </Card>
                <Card title="Mock tests">
                  <Table rows={d.mockProgress} cols={[["Mock", (m) => <b>Mock {m.n}</b>], ["Students", (m) => m.students], ["Average best", (m) => (m.avgBest == null ? "n/a" : `${m.avgBest}%`)]]} />
                </Card>
                <Card title="Last 8 weeks">
                  <Table rows={d.weeks} cols={[["Week to", (w) => w.label], ["Active", (w) => w.active], ["Tests", (w) => w.tests], ["Mock avg", (w) => (w.mockAvg == null ? "–" : `${w.mockAvg}%`)]]} />
                </Card>
              </div>
            </>
          )}

          {tab === "topics" && (
            <Card title="Weakest topics" right={<span className="small muted">at least 10 answers · compare with national</span>}>
              <Table rows={d.topics} empty="Topics appear once students have answered at least 10 questions in them." cols={[
                ["Topic", (t) => <><b>{t.topic}</b><div className="small muted">{t.subjectName}</div></>],
                ["Accuracy", (t) => <span style={{ background: tone(t.accuracy), color: ink(t.accuracy), padding: "4px 10px", borderRadius: 8, fontWeight: 700 }}>{t.accuracy}%</span>],
                ["National", (t) => (t.national == null ? "–" : `${t.national}%`)],
                ["Gap", (t) => (t.national == null ? "–" : <b style={{ color: t.accuracy >= t.national ? "#0B7A5E" : "#B3372D" }}>{t.accuracy - t.national >= 0 ? "+" : ""}{t.accuracy - t.national}</b>)],
                ["Students", (t) => t.students], ["Answers", (t) => t.answers],
                ["Suggested action", (t) => <span className="small">{t.accuracy < 40 ? "Re-teach in class, then assign the topic level" : t.accuracy < 60 ? "Assign the topic level and the topic video" : "Revise with a short quiz"}</span>],
              ]} />
            </Card>
          )}

          {tab === "groups" && (
            <div className="grid" style={{ gap: 16 }}>
              {([["By department", d.byDepartment], ["By program", d.byProgram], ["By semester", d.bySemester], ["By section", d.bySection]] as [string, Group[]][]).filter(([, rows]) => rows.length).map(([title, rows]) => (
                <Card key={title} title={title}>
                  <Table rows={rows} cols={[
                    ["Group", (g) => <b>{g.group}</b>], ["Registered", (g) => g.registered], ["Started", (g) => `${g.started} (${g.registered ? Math.round((100 * g.started) / g.registered) : 0}%)`],
                    ["Readiness", (g) => <span style={{ background: tone(g.readiness), color: ink(g.readiness), padding: "4px 10px", borderRadius: 8, fontWeight: 700 }}>{g.readiness ?? "n/a"}</span>],
                    ["Ready 70+", (g) => g.ready], ["Need support", (g) => (g.atRisk ? <Pill tone="bad">{g.atRisk}</Pill> : 0)], ["Weakest subject", (g) => g.weakSubject ?? "–"],
                  ]} />
                </Card>
              ))}
            </div>
          )}

          {tab === "students" && (
            <Card>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
                <Tabs value={only} onChange={setOnly} tabs={[["attention", `Need attention (${d.attention.length})`], ["top", "Top 10"], ["all", `All (${d.students.length})`]]} />
                <input placeholder="Search name or roll number" value={find} onChange={(e) => setFind(e.target.value)} style={{ marginLeft: "auto", minWidth: 220 }} />
                <button className="btn sec sm" onClick={() => csv(list)}>Download this list</button>
              </div>
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>Student</th><th>Readiness</th><th>Mocks</th>{SUBJ.map((k) => <th key={k} style={{ textAlign: "center" }}>{k}</th>)}<th>Why</th><th></th></tr></thead>
                  <tbody>
                    {list.slice(0, 200).map((s) => (
                      <tr key={s.userId}>
                        <td><b>{s.fullName}</b><div className="small muted">{s.rollNumber} · {s.program} {s.semester}{s.section ?? ""}{s.lastActive ? ` · seen ${fmtDate(s.lastActive)}` : ""}</div></td>
                        <td><span style={{ background: tone(s.started ? s.readiness : null), color: ink(s.started ? s.readiness : null), padding: "4px 10px", borderRadius: 8, fontWeight: 700 }}>{s.started ? s.readiness : "–"}</span></td>
                        <td>{s.mocksDone} of 3</td>
                        {SUBJ.map((k) => <td key={k} style={{ textAlign: "center", padding: 4 }}><span style={{ display: "inline-block", minWidth: 34, padding: "3px 4px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: tone(s.subjects[k] ?? null), color: ink(s.subjects[k] ?? null) }}>{s.subjects[k] ?? "–"}</span></td>)}
                        <td style={{ minWidth: 160 }}>{s.reasons.map((r) => <div key={r} className="small">• {r}</div>)}</td>
                        <td><button className="btn sm sec" onClick={() => download(`/api/reports/student?id=${s.userId}`, `report-${s.rollNumber}.pdf`)}>PDF</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!list.length && <p className="muted">No students in this list.</p>}
                {list.length > 200 && <p className="small muted">Showing 200 of {list.length}. Download the list to see everyone.</p>}
              </div>
            </Card>
          )}
        </>
      )}
    </Page>
  );
}
