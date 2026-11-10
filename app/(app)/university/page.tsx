"use client";
import Link from "next/link";
import { useState } from "react";
import { SUBJECT_SHORT } from "@/components/api";
import { Page, Card, Stat, useApi, Loading, Table, Tabs, download } from "@/components/ui";

type Row = { group: string; registered: number; active: number; pending: number; avgReadiness: number | null };
type Student = { userId: string; fullName: string; rollNumber: string; program: string; campus: string | null; department: string | null; readiness: number; tests: number; bestMock: number; lastActive: string | null };
type D = {
  registered: number; pending: number; active: number; mocksTaken: number; avgMockScore: number; avgReadiness: number;
  national: { rank: number; of: number; nationalAvg: number } | null;
  subjects: { key: string; name: string; weight: number; accuracy: number | null }[];
  weakTopics: { subject: string; topic: string; answers: number; accuracy: number }[];
  byCampus: Row[]; byDepartment: Row[]; byProgram: Row[]; bySection: Row[];
  atRisk: Student[]; notStarted: Student[]; students: Student[];
};

const heat = (p: number | null) => (p == null ? "#F1F3F2" : p >= 70 ? "#CDEBDB" : p >= 55 ? "#FBE7C4" : "#F6D2CD");

/** Dashboard scoped to the viewer: department for HODs, campus for campus admins, university for focal persons. */
export default function University() {
  const { data: d, error } = useApi<D>("/api/university");
  const [by, setBy] = useState<"byCampus" | "byDepartment" | "byProgram" | "bySection">("byProgram");
  if (!d) return <Loading error={error} />;
  return (
    <Page title="University dashboard" sub="Registrations, activity, mock scores and weak areas in your part of the university."
      actions={<>
        <button className="btn sec" onClick={() => download("/api/reports/university?format=xlsx", "nsct-report.xlsx")}>Excel</button>
        <button className="btn" onClick={() => download("/api/reports/university?format=pdf", "nsct-report.pdf")}>PDF report</button>
      </>}>
      {d.pending > 0 && <div className="notice" style={{ marginBottom: 16 }}>{d.pending} students are waiting for verification. <Link href="/students?status=PENDING">Verify now</Link></div>}
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat k="Registered" v={d.registered} d={`${d.pending} pending verification`} />
        <Stat k="Active" v={d.active} d={`${d.registered ? Math.round((100 * d.active) / d.registered) : 0}% have taken a test`} />
        <Stat k="Mock tests taken" v={d.mocksTaken} d={`average score ${d.avgMockScore}%`} />
        <Stat k={d.national ? "National rank" : "Avg readiness"} v={d.national ? <>{d.national.rank} <span className="muted" style={{ fontSize: 15 }}>of {d.national.of}</span></> : d.avgReadiness} d={d.national ? `your average ${d.avgReadiness}, national ${d.national.nationalAvg}` : undefined} />
      </div>
      <Card style={{ marginBottom: 16 }}>
        <Tabs value={by} onChange={setBy} tabs={[["byCampus", "By campus"], ["byDepartment", "By department"], ["byProgram", "By program"], ["bySection", "By section"]]} />
        <Table rows={d[by]} cols={[["Group", (r) => r.group], ["Registered", (r) => r.registered], ["Pending", (r) => r.pending], ["Active", (r) => r.active], ["Avg readiness", (r) => <b>{r.avgReadiness ?? "n/a"}</b>]]} />
      </Card>
      <div className="grid g2" style={{ marginBottom: 16 }}>
        <Card title="Subject heatmap">
          <table className="heat"><tbody><tr><th>Subject</th><th>Weight</th><th>Accuracy</th></tr>{d.subjects.map((s) => <tr key={s.key}><td>{s.name}</td><td>{s.weight}%</td><td className="c" style={{ background: heat(s.accuracy) }}>{s.accuracy == null ? "n/a" : `${s.accuracy}%`}</td></tr>)}</tbody></table>
        </Card>
        <Card title="Weakest topics">
          <Table rows={d.weakTopics} empty="Topics appear after 10 answers each." cols={[["Topic", (t) => <><span className="pill grey">{SUBJECT_SHORT[t.subject]}</span> {t.topic}</>], ["Answers", (t) => t.answers], ["Accuracy", (t) => <b>{t.accuracy}%</b>]]} />
          <p className="small muted">Share with faculty teaching these topics. Useful for OBE and curriculum reviews.</p>
        </Card>
      </div>
      <div className="grid g2">
        <Card title={`Students who need support (${d.atRisk.length})`}>
          <Table rows={d.atRisk.slice(0, 30)} empty="No active student is below 45." cols={[["Student", (s) => s.fullName], ["Roll", (s) => s.rollNumber], ["Program", (s) => <span className="small">{s.program}</span>], ["Readiness", (s) => <b style={{ color: "var(--bad)" }}>{s.readiness}</b>]]} />
        </Card>
        <Card title={`Not started (${d.notStarted.length})`}>
          <Table rows={d.notStarted.slice(0, 30)} empty="Everyone has started." cols={[["Student", (s) => s.fullName], ["Roll", (s) => s.rollNumber], ["Program", (s) => <span className="small">{s.program}</span>]]} />
          <p className="small muted">Send them a reminder from <Link href="/admin/notices">Announcements</Link>.</p>
        </Card>
      </div>
    </Page>
  );
}
