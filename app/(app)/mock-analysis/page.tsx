"use client";
import { useMemo, useState } from "react";
import { Page, Card, Stat, useApi, Loading, Table, Tabs, download } from "@/components/ui";

type Bands = { Ready: number; "Almost ready": number; "Needs work": number; "Not started": number };
type Sec = { key: string; name: string; short: string; weight: number; pct: number | null; questions: number };
type Dept = { department: string; registered: number; tookMock: number; tookPct: number; avgBest: number | null; m1: number | null; m2: number | null; m3: number | null; bands: Bands; readyPct: number; weakest: string[]; strongest: string | null };
type Stu = { userId: string; fullName: string; rollNumber: string; program: string; semester: string; section: string | null; department: string; mocksTaken: number; m1: number | null; m2: number | null; m3: number | null; best: number | null; latest: number | null; change: number | null; band: keyof Bands; sections: Record<string, number>; weak: string[]; advice: string; autoSubmitted: number };
type Data = {
  overall: { registered: number; tookMock: number; tookPct: number; funnel: { step: string; n: number }[]; avgBest: number | null; mockAvg: { n: number; avg: number | null; attempts: number }[]; bands: Bands; sections: Sec[]; improved: number; declined: number; avgChange: number | null; autoSubmitted: number; attempts: number };
  departments: Dept[]; students: Stu[]; filters: { departments: { id: string; name: string }[] }; scoped: boolean;
};

const BAND: [keyof Bands, string, string][] = [["Ready", "#13A47F", "70% and above"], ["Almost ready", "#E0A100", "50% to 69%"], ["Needs work", "#D9534F", "below 50%"], ["Not started", "#9AA5B8", "no mock yet"]];
const color = (b: keyof Bands) => BAND.find((x) => x[0] === b)![1];
const tone = (p: number) => (p >= 70 ? "#0B7A5E" : p >= 50 ? "#8A5A0B" : "#B3372D");
const bg = (p: number) => (p >= 70 ? "#D9F3E8" : p >= 50 ? "#FFF1D6" : "#FBE0DC");
const SUBJ: [string, string][] = [["PS", "PS"], ["PROG", "Prog"], ["DSA", "DSA"], ["DB", "DB"], ["SE", "SE"], ["WEB", "Web"], ["AI", "AI"], ["NET", "Net"], ["OS", "OS"], ["SEC", "Sec"]];

function Score({ v }: { v: number | null }) {
  return v == null ? <span style={{ color: "var(--muted)" }}>-</span> : <b style={{ color: tone(v) }}>{v}%</b>;
}
function BandPill({ b }: { b: keyof Bands }) {
  return <span style={{ background: color(b) + "22", color: color(b), padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{b}</span>;
}
/** One stacked bar showing how many students sit in each readiness band. */
function BandBar({ bands, total }: { bands: Bands; total: number }) {
  if (!total) return <span style={{ color: "var(--muted)" }}>-</span>;
  return (
    <div style={{ display: "flex", height: 12, borderRadius: 99, overflow: "hidden", minWidth: 140, background: "#EEF1F6" }} title={BAND.map(([k]) => `${k}: ${bands[k]}`).join(", ")}>
      {BAND.map(([k, c]) => bands[k] ? <div key={k} style={{ width: `${(100 * bands[k]) / total}%`, background: c }} /> : null)}
    </div>
  );
}
function HBar({ label, pct, sub }: { label: string; pct: number | null; sub?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "170px 1fr 52px", gap: 10, alignItems: "center", margin: "7px 0" }}>
      <div style={{ fontSize: 13 }}>{label}{sub && <div style={{ fontSize: 11, color: "var(--muted)" }}>{sub}</div>}</div>
      <div style={{ height: 10, background: "#EEF1F6", borderRadius: 99, overflow: "hidden" }}>{pct != null && <div style={{ width: `${pct}%`, height: "100%", background: tone(pct), borderRadius: 99 }} />}</div>
      <div style={{ textAlign: "right" }}><Score v={pct} /></div>
    </div>
  );
}

/** Mock test analysis: how ready the students are, overall, department-wise and student-wise. */
export default function MockAnalysis() {
  const [tab, setTab] = useState<"overall" | "dept" | "students">("overall");
  const [dept, setDept] = useState("");
  const [q, setQ] = useState("");
  const [bandF, setBandF] = useState("");
  const { data, error } = useApi<Data>(`/api/results/analysis?department=${encodeURIComponent(dept)}`, [dept]);

  const students = useMemo(() => (data?.students ?? []).filter((s) => (!bandF || s.band === bandF) && (!q || `${s.fullName} ${s.rollNumber}`.toLowerCase().includes(q.toLowerCase()))), [data, q, bandF]);
  const o = data?.overall;

  return (
    <Page title="Mock test analysis" sub="How ready your students are for NSCT, based on Mock 1, 2 and 3. Ready means a best score of 70% or more."
      actions={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {data && data.filters.departments.length > 1 && !data.scoped && (
          <select className="input" value={dept} onChange={(e) => setDept(e.target.value)} style={{ width: "auto" }}>
            <option value="">All departments</option>
            {data.filters.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        <button className="btn sec" onClick={() => download(`/api/results/analysis?format=xlsx&department=${encodeURIComponent(dept)}`, "mock-analysis.xlsx")}>Download analysis (Excel)</button>
      </div>}>
      {!data || !o ? <Loading error={error} /> : (
        <>
          <div className="grid g4" style={{ marginBottom: 14 }}>
            <Stat k="Registered students" v={o.registered} d={`${o.tookMock} took a mock (${o.tookPct}%)`} />
            <Stat k="Average best score" v={o.avgBest == null ? "-" : `${o.avgBest}%`} d="Best mock of each student" />
            <Stat k="Ready for NSCT" v={o.bands.Ready} d={`${o.registered ? Math.round((100 * o.bands.Ready) / o.registered) : 0}% of all students`} />
            <Stat k="Improved between mocks" v={o.improved} d={o.avgChange == null ? "Needs two mocks" : `Average change ${o.avgChange > 0 ? "+" : ""}${o.avgChange} points`} />
          </div>
          <Tabs tabs={[["overall", "Overall"], ["dept", "Department-wise"], ["students", "Student-wise"]]} value={tab} onChange={setTab} />

          {tab === "overall" && (
            <div className="grid g2" style={{ marginTop: 14 }}>
              <Card title="Readiness of students">
                <BandBar bands={o.bands} total={o.registered} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                  {BAND.map(([k, c, d]) => (
                    <button key={k} onClick={() => { setBandF(k); setTab("students"); }} style={{ textAlign: "left", border: "1px solid var(--line)", borderLeft: `4px solid ${c}`, borderRadius: 10, padding: "10px 12px", background: "#fff", cursor: "pointer" }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{o.bands[k]}</div>
                      <div style={{ fontWeight: 600 }}>{k}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>{d}</div>
                    </button>
                  ))}
                </div>
              </Card>
              <Card title="Participation">
                {o.funnel.map((f) => <HBar key={f.step} label={f.step} pct={o.registered ? Math.round((100 * f.n) / o.registered) : 0} sub={`${f.n} students`} />)}
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>{o.attempts} mock attempts in total. {o.autoSubmitted ? `${o.autoSubmitted} were auto-submitted (time ran out or the student left the test screen).` : ""}</div>
              </Card>
              <Card title="Average score per mock">
                {o.mockAvg.map((m) => <HBar key={m.n} label={`Mock ${m.n}`} pct={m.avg} sub={`${m.attempts} attempts`} />)}
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>{o.improved} students improved and {o.declined} dropped from their first to their latest mock.</div>
              </Card>
              <Card title="Section-wise performance (NSCT weight)">
                {o.sections.map((s) => <HBar key={s.key} label={s.short} sub={`${s.weight}% of NSCT`} pct={s.pct} />)}
              </Card>
              <Card title="What to do next" style={{ gridColumn: "1 / -1" }}>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                  {o.bands["Not started"] > 0 && <li><b>{o.bands["Not started"]} students</b> have not taken any mock. Remind them to take Mock 1 this week.</li>}
                  {o.bands["Needs work"] > 0 && <li><b>{o.bands["Needs work"]} students</b> score below 50%. Arrange revision sessions on the weakest sections below.</li>}
                  {o.sections.filter((s) => s.pct != null).sort((a, b) => a.pct! - b.pct!).slice(0, 3).map((s) => <li key={s.key}>Weak section: <b>{s.name}</b> at {s.pct}% ({s.weight}% of the NSCT paper). Point students to its Preparation levels and videos.</li>)}
                  {o.bands["Almost ready"] > 0 && <li><b>{o.bands["Almost ready"]} students</b> are close (50% to 69%). One more focused mock can move them to Ready.</li>}
                </ul>
              </Card>
            </div>
          )}

          {tab === "dept" && (
            <Card title="Department comparison" style={{ marginTop: 14 }}>
              <Table rows={data.departments} empty="No departments yet." cols={[
                ["Department", (d) => <b>{d.department}</b>],
                ["Students", (d) => d.registered],
                ["Took a mock", (d) => `${d.tookMock} (${d.tookPct}%)`],
                ["Avg best", (d) => <Score v={d.avgBest} />],
                ["Mock 1", (d) => <Score v={d.m1} />], ["Mock 2", (d) => <Score v={d.m2} />], ["Mock 3", (d) => <Score v={d.m3} />],
                ["Readiness", (d) => <BandBar bands={d.bands} total={d.registered} />],
                ["Ready", (d) => `${d.bands.Ready} (${d.readyPct}%)`],
                ["Weakest sections", (d) => d.weakest.join(", ") || "-"],
                ["Strongest", (d) => d.strongest ?? "-"],
              ]} />
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
                {BAND.map(([k, c]) => <span key={k}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: c, marginRight: 5 }} />{k}</span>)}
              </div>
            </Card>
          )}

          {tab === "students" && (
            <Card title={`Students (${students.length})`} style={{ marginTop: 14 }} right={
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input className="input" placeholder="Search name or roll number" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
                <select className="input" value={bandF} onChange={(e) => setBandF(e.target.value)} style={{ width: "auto" }}>
                  <option value="">All readiness levels</option>
                  {BAND.map(([k]) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>}>
              <div style={{ overflowX: "auto" }}>
                <Table rows={students} empty="No students match." cols={[
                  ["#", (s) => students.indexOf(s) + 1],
                  ["Student", (s) => <div><b>{s.fullName}</b><div style={{ fontSize: 12, color: "var(--muted)" }}>{s.rollNumber} · {s.program} {s.semester}{s.section ?? ""}</div></div>],
                  ["Department", (s) => s.department],
                  ["Readiness", (s) => <BandPill b={s.band} />],
                  ["Mock 1", (s) => <Score v={s.m1} />], ["Mock 2", (s) => <Score v={s.m2} />], ["Mock 3", (s) => <Score v={s.m3} />],
                  ["Change", (s) => s.change == null ? "-" : <b style={{ color: s.change >= 0 ? "#0B7A5E" : "#B3372D" }}>{s.change > 0 ? "+" : ""}{s.change}</b>],
                  ["Sections", (s) => <div style={{ display: "flex", gap: 2 }}>{SUBJ.map(([k, l]) => s.sections[k] == null ? null : <span key={k} title={`${l}: ${s.sections[k]}%`} style={{ fontSize: 10, padding: "2px 4px", borderRadius: 4, background: bg(s.sections[k]), color: tone(s.sections[k]), fontWeight: 700 }}>{l}</span>)}</div>],
                  ["Advice", (s) => <span style={{ fontSize: 12 }}>{s.advice}</span>],
                  ["", (s) => s.mocksTaken ? <a className="btn sm sec" href={`/mock-results?q=${encodeURIComponent(s.rollNumber)}`}>Results</a> : null],
                ]} />
              </div>
            </Card>
          )}
        </>
      )}
    </Page>
  );
}
