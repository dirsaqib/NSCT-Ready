"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, SUBJECT_SHORT } from "@/components/api";
import { Page, Card, useApi, Loading, Table, Pill, Tabs, fmtDate, download, upload } from "@/components/ui";

type S = {
  userId: string; fullName: string; rollNumber: string; program: string; semester: string; section: string | null; rejectReason: string | null; extraTimePct: number;
  readiness: number; createdAt: string; campus: { name: string } | null; department: { name: string } | null;
  user: { id: string; email: string | null; phone: string | null; status: string; lastSeenAt: string | null; _count: { attempts: number } };
};
type Detail = { user: { email: string | null; phone: string | null; status: string; profile: S }; mastery: { subject: string; correct: number; total: number }[]; topics: { subject: string; topic: string; correct: number; total: number }[]; attempts: { id: string; type: string; score: number; percentile: number | null; submittedAt: string; tabSwitches: number; flags: string[] }[] };

export default function StudentsPage() { return <Suspense fallback={<div className="spin" />}><Students /></Suspense>; }

/** Verification queue, student records, bulk upload and per-student reports. */
function Students() {
  const initial = useSearchParams().get("status") ?? "PENDING";
  const [status, setStatus] = useState(initial);
  const [q, setQ] = useState("");
  const { data, error, reload } = useApi<{ total: number; students: S[] }>(`/api/students?status=${status === "ALL" ? "" : status}&q=${encodeURIComponent(q)}`, [status, q]);
  const [open, setOpen] = useState<Detail | null>(null);
  const [msg, setMsg] = useState("");

  const act = async (id: string, action: string, extra: object = {}) => {
    try { await api(`/api/students/${id}`, { method: "PATCH", body: { action, ...extra } }); reload(); if (open) setOpen(null); }
    catch (e) { setMsg((e as Error).message); }
  };

  return (
    <Page title="Students and verification" sub="Verify registrations, manage records and upload your batch."
      actions={<button className="btn sec" onClick={() => download("/api/reports/university?format=xlsx", "students.xlsx")}>Download Excel</button>}>
      <Card title="Bulk upload from Excel or Moodle" style={{ marginBottom: 16 }}>
        <p className="small muted" style={{ marginTop: 0 }}>Columns: full_name, roll_number, email, phone, program, semester, section, campus, department. A Moodle user export (firstname, lastname, idnumber, email) also works. Uploaded students are verified automatically and get a sign-in message.</p>
        <form className="row" onSubmit={async (e) => {
          e.preventDefault(); setMsg("Uploading...");
          try { const r = await upload<{ created: number; updated: number; failed: { row: number; error: string }[] }>("/api/students/import", new FormData(e.currentTarget)); setMsg(`Added ${r.created}, updated ${r.updated}. ${r.failed.length ? `Failed rows: ${r.failed.map((f) => `${f.row} (${f.error})`).join("; ")}` : ""}`); reload(); }
          catch (er) { setMsg((er as Error).message); }
        }}>
          <input type="file" name="file" accept=".xlsx" required />
          <button className="btn" type="submit">Upload</button>
        </form>
      </Card>
      {msg && <div className="notice info" style={{ marginBottom: 12 }}>{msg}</div>}
      <div className="card">
        <Tabs value={status} onChange={setStatus} tabs={[["PENDING", "Waiting for verification"], ["VERIFIED", "Verified"], ["ACTIVE", "Active"], ["BLOCKED", "Deactivated"], ["ALL", "All"]]} />
        <input type="text" placeholder="Search name or roll number" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320, marginBottom: 12 }} />
        {!data ? <Loading error={error} /> : (
          <Table rows={data.students} empty="No students here." cols={[
            ["Name", (s) => <button className="btn ghost sm" onClick={async () => setOpen(await api<Detail>(`/api/students/${s.userId}`))}><b>{s.fullName}</b></button>],
            ["Roll number", (s) => s.rollNumber],
            ["Program", (s) => <span className="small">{s.program} · {s.semester}{s.section ?? ""}</span>],
            ["Campus / dept.", (s) => <span className="small">{s.campus?.name ?? ""} {s.department ? `· ${s.department.name}` : ""}</span>],
            ["Contact", (s) => <span className="tiny">{s.user.email ?? s.user.phone}</span>],
            ["Status", (s) => <><Pill tone={s.user.status === "PENDING" ? "warn" : s.user.status === "BLOCKED" ? "bad" : undefined}>{s.user.status.toLowerCase()}</Pill>{s.rejectReason && <div className="tiny" style={{ color: "var(--bad)" }}>Asked to fix</div>}</>],
            ["Tests", (s) => s.user._count.attempts],
            ["Actions", (s) => (
              <div className="row">
                {s.user.status === "PENDING" && <button className="btn sm" onClick={() => act(s.userId, "verify")}>Verify</button>}
                {s.user.status === "PENDING" && <button className="btn sm sec" onClick={() => { const reason = window.prompt("What should the student correct?"); if (reason) act(s.userId, "reject", { reason }); }}>Ask to fix</button>}
                {s.user.status !== "BLOCKED" ? <button className="btn ghost sm" onClick={() => window.confirm("Deactivate this student?") && act(s.userId, "deactivate")}>Deactivate</button> : <button className="btn ghost sm" onClick={() => act(s.userId, "activate")}>Activate</button>}
              </div>
            )],
          ]} />
        )}
      </div>

      {open && (
        <div className="card" style={{ marginTop: 16, borderColor: "var(--brand)" }}>
          <div className="row between"><h2 style={{ margin: 0 }}>{open.user.profile.fullName}</h2><button className="btn sec sm" onClick={() => setOpen(null)}>Close</button></div>
          <p className="sub">{open.user.profile.rollNumber} · {open.user.profile.program} · {open.user.email ?? open.user.phone}</p>
          <form className="row" style={{ margin: "12px 0" }} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); act(open.user.profile.userId, "edit", { edit: { rollNumber: String(f.get("roll")), section: String(f.get("section") || ""), extraTimePct: Number(f.get("extra") || 0) } }); }}>
            <label className="small">Roll number <input name="roll" type="text" defaultValue={open.user.profile.rollNumber} style={{ width: 160 }} /></label>
            <label className="small">Section <input name="section" type="text" defaultValue={open.user.profile.section ?? ""} style={{ width: 70 }} /></label>
            <label className="small">Extra time % (disability) <input name="extra" type="number" min={0} max={100} defaultValue={open.user.profile.extraTimePct} style={{ width: 80 }} /></label>
            <button className="btn sm" type="submit">Save changes</button>
            <button className="btn sm sec" type="button" onClick={() => download(`/api/reports/university?format=pdf&id=${open.user.profile.userId}`, "student-report.pdf")}>Student report (PDF)</button>
          </form>
          <div className="grid g2">
            <div><h3>Subject accuracy</h3><table><tbody>{open.mastery.map((m) => <tr key={m.subject}><td>{SUBJECT_SHORT[m.subject]}</td><td><b>{Math.round((100 * m.correct) / (m.total || 1))}%</b></td><td className="tiny muted">{m.total} answers</td></tr>)}</tbody></table></div>
            <div><h3>Tests</h3><Table rows={open.attempts} cols={[["Type", (a) => a.type], ["Score", (a) => `${a.score}%`], ["Date", (a) => fmtDate(a.submittedAt)], ["Flags", (a) => a.flags.length ? <Pill tone="bad">{a.flags.length}</Pill> : ""]]} empty="No tests yet." /></div>
          </div>
        </div>
      )}
    </Page>
  );
}
