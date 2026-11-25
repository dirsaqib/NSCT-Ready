"use client";
import { useMemo, useState } from "react";
import { Page, Card, Stat, useApi, Loading, Table, Tabs, download } from "@/components/ui";

type Bands = { Ready: number; "Almost ready": number; "Needs work": number; "Not started": number };
type Sec = { key: string; name: string; short: string; weight: number; pct: number | null; questions: number };
type Group = { name: string; registered: number; appeared: number; appearedPct: number; sharePct: number; avgBest: number | null; avgPercentile: number | null; readyPct: number; bands: Bands };
type Stu = { userId: string; fullName: string; rollNumber: string; program: string; semester: string; section: string | null; department: string; campus: string; university: string; mocksTaken: number; best: number | null; percentile: number | null; band: keyof Bands; weak: string[] };
type Data = {
  overall: { registered: number; tookMock: number; tookPct: number; avgBest: number | null; avgPercentile: number | null; nationalTakers: number; nationalAvg: number | null; bands: Bands; sections: Sec[]; attempts: number };
  deptGroups: Group[]; programs: Group[]; campuses: Group[]; universities: Group[]; students: Stu[];
  filters: { departments: { id: string; name: string }[]; campuses: { id: string; name: string }[]; universities: { id: string; name: string }[] }; isAdmin: boolean; scoped: boolean;
};
type TabKey = "subjects" | "students" | "dept" | "programs" | "campus" | "uni";

const BLUE = "#1D55CC", GREEN = "#13A47F", RED = "#D9534F", GREY = "#9AA5B8";
const TIER: [string, string, string][] = [["Weakest", RED, "lowest three subjects"], ["Average", BLUE, "middle subjects"], ["Strongest", GREEN, "highest three subjects"]];

/** A horizontal bar with its value printed at the end. Hover shows the full detail. */
function Bar({ v, max, color, label, title }: { v: number; max: number; color: string; label: string; title: string }) {
  return (
    <div title={title} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <div style={{ flex: 1, height: 18, background: "#EEF1F6", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${max ? Math.max(1.5, (100 * v) / max) : 0}%`, height: "100%", background: color, borderRadius: "0 4px 4px 0", transition: "width .6s ease" }} />
      </div>
      <b style={{ fontSize: 13, minWidth: 64, color: "var(--ink)" }}>{label}</b>
    </div>
  );
}

/** Participation and performance for any grouping, as two aligned bars on one row (two scales, never one dual axis). */
function GroupChart({ rows, noun, total }: { rows: Group[]; noun: string; total: number }) {
  const maxN = Math.max(1, ...rows.map((r) => r.appeared));
  if (!rows.length) return <div className="empty">No data yet.</div>;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(110px,190px) 1fr 1fr", gap: "6px 18px", alignItems: "center", fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 6 }}>
        <span>{noun}</span><span><i style={{ display: "inline-block", width: 10, height: 10, background: BLUE, borderRadius: 2, marginRight: 6 }} />Students who appeared</span><span><i style={{ display: "inline-block", width: 10, height: 10, background: GREEN, borderRadius: 2, marginRight: 6 }} />Average national percentile</span>
      </div>
      {rows.map((r) => (
        <div key={r.name} style={{ display: "grid", gridTemplateColumns: "minmax(110px,190px) 1fr 1fr", gap: "6px 18px", alignItems: "center", padding: "7px 0", borderTop: "1px solid var(--line)" }}>
          <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis" }} title={r.name}>{r.name}<div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>{r.registered} registered · {r.readyPct}% ready</div></div>
          <Bar v={r.appeared} max={maxN} color={BLUE} label={`${r.appeared} (${total ? Math.round((100 * r.appeared) / total) : 0}%)`} title={`${r.name}: ${r.appeared} of ${r.registered} registered students appeared (${r.appearedPct}%). Share of all who appeared: ${r.sharePct}%.`} />
          {r.avgPercentile == null ? <span style={{ color: "var(--muted)", fontSize: 13 }}>No mock yet</span> : <Bar v={r.avgPercentile} max={100} color={GREEN} label={`${r.avgPercentile}`} title={`${r.name}: average national percentile ${r.avgPercentile}, average best score ${r.avgBest ?? "-"}%.`} />}
        </div>
      ))}
    </div>
  );
}

function Insight({ rows, noun }: { rows: Group[]; noun: string }) {
  const done = rows.filter((r) => r.avgPercentile != null && r.appeared > 0);
  if (done.length < 2) return null;
  const most = [...rows].sort((a, b) => b.appeared - a.appeared)[0], best = done[0], low = done[done.length - 1];
  return (
    <p className="small" style={{ marginTop: 14, marginBottom: 0, color: "var(--muted)" }}>
      <b style={{ color: "var(--ink)" }}>{most.name}</b> has the largest participation ({most.appeared} students). <b style={{ color: "var(--ink)" }}>{best.name}</b> shows the strongest average percentile ({best.avgPercentile}), while <b style={{ color: "var(--ink)" }}>{low.name}</b> ({low.avgPercentile}) needs focused support. Hover any bar for detail.
    </p>
  );
}

/** Result reports: subject-wise, student-wise, department, program, campus and university views of mock results. */
export default function ResultReports() {
  const [tab, setTab] = useState<TabKey>("subjects");
  const [f, setF] = useState({ department: "", campus: "", university: "" });
  const [q, setQ] = useState("");
  const [band, setBand] = useState("");
  const qs = `department=${encodeURIComponent(f.department)}&campus=${encodeURIComponent(f.campus)}&university=${encodeURIComponent(f.university)}`;
  const { data, error } = useApi<Data>(`/api/results/analysis?${qs}`, [qs]);

  const subjects = useMemo(() => (data?.overall.sections ?? []).filter((s) => s.pct != null).sort((a, b) => a.pct! - b.pct!), [data]);
  const tierOf = (i: number, n: number) => (i < Math.min(3, Math.floor(n / 3) || 1) ? 0 : i >= n - Math.min(3, Math.floor(n / 3) || 1) ? 2 : 1);
  const students = useMemo(() => (data?.students ?? []).filter((s) => (!band || s.band === band) && (!q || `${s.fullName} ${s.rollNumber}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (b.percentile ?? -1) - (a.percentile ?? -1) || a.rollNumber.localeCompare(b.rollNumber)), [data, q, band]);

  const sel = (key: keyof typeof f, opts: { id: string; name: string }[], all: string) => opts.length > 1 && (
    <select className="input" style={{ width: "auto" }} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}>
      <option value="">{all}</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );

  const o = data?.overall;
  const showUni = !!data && (data.isAdmin || data.universities.length > 1);
  const tabs: [TabKey, string][] = [["subjects", "Subject-wise"], ["students", "Student-wise"], ["dept", "Department-wise"], ["programs", "Program-wise"], ["campus", "Campus-wise"], ...(showUni ? [["uni", "University-wise"] as [TabKey, string]] : [])];

  return (
    <Page title="Result reports" sub="Mock test results by subject, student, department, program, campus and university. Percentile compares each student with every student in Pakistan who took a TayariHub mock."
      actions={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {data && sel("university", data.filters.universities, "All universities")}
        {data && sel("campus", data.filters.campuses, "All campuses")}
        {data && !data.scoped && sel("department", data.filters.departments, "All departments")}
        <button className="btn sec" onClick={() => download(`/api/results/analysis?format=xlsx&${qs}`, "result-reports.xlsx")}>Download (Excel)</button>
      </div>}>
      {!data || !o ? <Loading error={error} /> : (
        <>
          <div className="grid g4" style={{ marginBottom: 14 }}>
            <Stat k="Students appeared" v={o.tookMock} d={`of ${o.registered} registered (${o.tookPct}%)`} />
            <Stat k="Average best score" v={o.avgBest == null ? "-" : `${o.avgBest}%`} d={o.nationalAvg == null ? "" : `National average ${o.nationalAvg}%`} />
            <Stat k="Average national percentile" v={o.avgPercentile ?? "-"} d={`Among ${o.nationalTakers.toLocaleString()} students nationally`} />
            <Stat k="Ready for NSCT" v={o.bands.Ready} d="Best mock score 70% or more" />
          </div>
          <Tabs tabs={tabs} value={tab} onChange={setTab} />

          {tab === "subjects" && (
            <Card title="Subject-wise proficiency breakdown" style={{ marginTop: 14 }}>
              <p className="small muted" style={{ marginTop: -6 }}>Average correct answers as a percentage of questions asked in each subject, across all mocks taken.</p>
              {!subjects.length ? <div className="empty">No mock results yet.</div> : (
                <>
                  {subjects.map((s, i) => { const t = TIER[tierOf(i, subjects.length)]; return (
                    <div key={s.key} style={{ display: "grid", gridTemplateColumns: "minmax(140px,240px) 1fr", gap: 14, alignItems: "center", margin: "8px 0" }}>
                      <div style={{ fontSize: 13, textAlign: "right" }}>{s.name}<div style={{ fontSize: 11, color: "var(--muted)" }}>{s.weight}% of NSCT · {s.questions} answers</div></div>
                      <Bar v={s.pct!} max={100} color={t[1]} label={`${s.pct}%`} title={`${s.name}: ${s.pct}% correct (${t[0].toLowerCase()} group)`} />
                    </div>); })}
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "var(--muted)", margin: "10px 0 16px" }}>
                    {TIER.map(([k, c, d]) => <span key={k}><i style={{ display: "inline-block", width: 10, height: 10, background: c, borderRadius: 2, marginRight: 6 }} />{k} ({d})</span>)}
                  </div>
                  <div className="grid g2">
                    <div style={{ border: "1px solid #F3C9C5", background: "#FDF1F0", borderRadius: 12, padding: 16, textAlign: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#B3372D" }}>▼ CRITICAL WEAKNESS</div>
                      <div style={{ fontSize: 18, fontWeight: 800, margin: "4px 0" }}>{subjects[0].name} ({subjects[0].pct}%)</div>
                      <div className="small muted">Lowest average. Arrange revision sessions and point students to its Preparation levels.</div>
                    </div>
                    <div style={{ border: "1px solid #BFE8DA", background: "#EEFAF5", borderRadius: 12, padding: 16, textAlign: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#0B7A5E" }}>▲ HIGHEST STRENGTH</div>
                      <div style={{ fontSize: 18, fontWeight: 800, margin: "4px 0" }}>{subjects[subjects.length - 1].name} ({subjects[subjects.length - 1].pct}%)</div>
                      <div className="small muted">Highest average. Keep it steady and spend more time on weak subjects.</div>
                    </div>
                  </div>
                </>
              )}
            </Card>
          )}

          {tab === "students" && (
            <Card title={`Student-wise results (${students.length})`} style={{ marginTop: 14 }} right={
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input className="input" placeholder="Search name or roll number" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 210 }} />
                <select className="input" style={{ width: "auto" }} value={band} onChange={(e) => setBand(e.target.value)}>
                  <option value="">All students</option>{["Ready", "Almost ready", "Needs work", "Not started"].map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>}>
              <div style={{ overflowX: "auto" }}>
                <Table rows={students} empty="No students match." cols={[
                  ["Rank", (s) => (s.percentile == null ? "-" : students.filter((x) => x.percentile != null).indexOf(s) + 1)],
                  ["Student", (s) => <div><b>{s.fullName}</b><div style={{ fontSize: 12, color: "var(--muted)" }}>{s.rollNumber}</div></div>],
                  ["Program", (s) => `${s.program} ${s.semester}${s.section ?? ""}`],
                  ["Department", (s) => s.department],
                  ["Campus", (s) => s.campus],
                  ...(showUni ? [["University", (s: Stu) => s.university] as [string, (s: Stu) => React.ReactNode]] : []),
                  ["Mocks", (s) => s.mocksTaken],
                  ["Best score", (s) => (s.best == null ? "-" : `${s.best}%`)],
                  ["National percentile", (s) => s.percentile == null ? <span className="muted">Not taken</span> : <div style={{ minWidth: 120 }}><Bar v={s.percentile} max={100} color={GREEN} label={`${s.percentile}`} title={`Better than about ${s.percentile}% of students nationally`} /></div>],
                  ["Readiness", (s) => s.band],
                  ["Weak subjects", (s) => <span style={{ fontSize: 12 }}>{s.weak.join(", ") || "-"}</span>],
                ]} />
              </div>
            </Card>
          )}

          {tab === "dept" && <Card title="Department-wise participation and performance" style={{ marginTop: 14 }}><GroupChart rows={data.deptGroups} noun="Department" total={o.tookMock} /><Insight rows={data.deptGroups} noun="department" /></Card>}
          {tab === "programs" && <Card title="Program-wise participation and performance" style={{ marginTop: 14 }}><GroupChart rows={data.programs} noun="Program" total={o.tookMock} /><Insight rows={data.programs} noun="program" /></Card>}
          {tab === "campus" && <Card title="Campus-wise participation and performance" style={{ marginTop: 14 }}><GroupChart rows={data.campuses} noun="Campus" total={o.tookMock} /><Insight rows={data.campuses} noun="campus" /></Card>}
          {tab === "uni" && <Card title="University-wise participation and performance" style={{ marginTop: 14 }}><GroupChart rows={data.universities} noun="University" total={o.tookMock} /><Insight rows={data.universities} noun="university" /></Card>}
          {["dept", "programs", "campus", "uni"].includes(tab) && <p className="tiny muted" style={{ marginTop: 12 }}>Percentages in the blue bars are each group&apos;s share of all students who appeared. Groups are ordered by average national percentile.</p>}
        </>
      )}
    </Page>
  );
}
