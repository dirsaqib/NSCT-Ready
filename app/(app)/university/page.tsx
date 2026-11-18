"use client";
import Link from "next/link";
import { Page, Card, Stat, useApi, Loading, Table } from "@/components/ui";

type Student = { userId: string; fullName: string; rollNumber: string; program: string; readiness: number; tests: number };
type D = {
  registered: number; pending: number; active: number; prepSessions: number; avgReadiness: number;
  mockProgress: { n: number; students: number; avgBest: number | null; above90: number }[];
  subjects: { key: string; name: string; weight: number; accuracy: number | null }[];
  atRisk: Student[]; notStarted: Student[];
};

const heat = (p: number | null) => (p == null ? "#F1F3F2" : p >= 80 ? "#CDEBDB" : p >= 60 ? "#FBE7C4" : "#F6D2CD");

/** Focal person home: four jobs (register, verify, add questions, report) and a short view of how students are doing. */
export default function University() {
  const { data: d, error } = useApi<D>("/api/university");
  if (!d) return <Loading error={error} />;
  return (
    <Page title="Focal person dashboard" sub="Your university's students only.">
      <div className="big3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
        <Link href="/students" className="card"><div className="ico">👥</div><b>Register students</b><span className="small muted">Upload an Excel sheet. Everyone gets a login and password.</span></Link>
        <Link href="/students?status=PENDING" className="card"><div className="ico" style={{ background: d.pending ? "var(--accent-soft)" : undefined }}>✅</div><b>Verify students{d.pending ? ` (${d.pending})` : ""}</b><span className="small muted">Check the proof of students who registered themselves.</span></Link>
        <Link href="/contribute" className="card"><div className="ico" style={{ background: "#E8F0FB" }}>❓</div><b>Add questions</b><span className="small muted">For your university or one department only, or for everyone.</span></Link>
        <Link href="/students#reports" className="card"><div className="ico" style={{ background: "#F1ECFB" }}>📄</div><b>Reports for HODs</b><span className="small muted">A detailed PDF page for every student.</span></Link>
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat k="Registered" v={d.registered} d={`${d.pending} waiting for you`} />
        <Stat k="Active" v={d.active} d={`${d.registered ? Math.round((100 * d.active) / d.registered) : 0}% have started`} />
        <Stat k="Preparation, last 7 days" v={d.prepSessions} d="levels and boss rounds played" />
        <Stat k="Average readiness" v={d.avgReadiness} d="out of 100" />
      </div>

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <Card title="Mock tests">
          <Table rows={d.mockProgress} cols={[["Mock", (m) => <b>Mock {m.n}</b>], ["Students", (m) => m.students], ["Average best", (m) => (m.avgBest == null ? "n/a" : `${m.avgBest}%`)], ["90% or more", (m) => m.above90]]} />
        </Card>
        <Card title="Subjects">
          <table className="heat"><tbody>{d.subjects.map((s) => <tr key={s.key}><td className="small">{s.name}</td><td className="c" style={{ background: heat(s.accuracy) }}>{s.accuracy == null ? "n/a" : `${s.accuracy}%`}</td></tr>)}</tbody></table>
        </Card>
      </div>

      <div className="grid g2">
        <Card title={`Need support (${d.atRisk.length})`}>
          <Table rows={d.atRisk.slice(0, 20)} empty="No active student is below 45." cols={[["Student", (s) => s.fullName], ["Roll", (s) => s.rollNumber], ["Readiness", (s) => <b style={{ color: "var(--bad)" }}>{s.readiness}</b>]]} />
        </Card>
        <Card title={`Not started yet (${d.notStarted.length})`}>
          <Table rows={d.notStarted.slice(0, 20)} empty="Everyone has started." cols={[["Student", (s) => s.fullName], ["Roll", (s) => s.rollNumber]]} />
        </Card>
      </div>
    </Page>
  );
}
