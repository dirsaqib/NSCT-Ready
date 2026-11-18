"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, SUBJECT_SHORT } from "@/components/api";
import { Page, Card, Stat, useApi, Loading, Table, Pill, Tabs, fmtDate, download, upload } from "@/components/ui";

type S = {
  userId: string; fullName: string; rollNumber: string; program: string; semester: string; section: string | null; rejectReason: string | null; extraTimePct: number;
  readiness: number; createdAt: string; campus: { name: string } | null; department: { name: string } | null; campusName?: string | null; departmentName?: string | null; gender?: string | null;
  user: { id: string; email: string | null; phone: string | null; status: string; lastSeenAt: string | null; uploads?: { id: string; filename: string }[]; _count: { attempts: number } };
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
  const [creds, setCreds] = useState<Cred[] | null>(null);

  const act = async (id: string, action: string, extra: object = {}) => {
    try { await api(`/api/students/${id}`, { method: "PATCH", body: { action, ...extra } }); reload(); if (open) setOpen(null); }
    catch (e) { setMsg((e as Error).message); }
  };
  const reset = async (s: S) => {
    if (!window.confirm(`Reset the password of ${s.fullName}? They must choose a new one at next sign-in.`)) return;
    try { const r = await api<{ tempPassword: string }>(`/api/students/${s.userId}`, { method: "PATCH", body: { action: "resetPassword" } }); setCreds([{ name: s.fullName, rollNumber: s.rollNumber, password: r.tempPassword, status: "reset" }]); }
    catch (e) { setMsg((e as Error).message); }
  };

  return (
    <Page title="Students and verification" sub="Verify registrations, manage records and upload your batch."
      actions={<button className="btn sec" onClick={() => download("/api/reports/university?format=xlsx", "students.xlsx")}>Download Excel</button>}>
      <Card title="Bulk upload from Excel or Moodle" style={{ marginBottom: 16 }}>
        <p className="small muted" style={{ marginTop: 0 }}>Columns: full_name, roll_number, program, semester, section, campus, department, and optionally email and phone. A Moodle user export (firstname, lastname, idnumber, email) also works. Every new student gets a login (university plus roll number) and a temporary password, which they must change at first sign-in. Download or print the list after upload.</p>
        <form className="row" onSubmit={async (e) => {
          e.preventDefault(); setMsg("Uploading...");
          const fd = new FormData(e.currentTarget);
          try { const r = await upload<{ created: number; updated: number; failed: { row: number; error: string }[]; credentials: Cred[] }>("/api/students/import", fd); setMsg(`Added ${r.created}, updated ${r.updated}. ${r.failed.length ? `Failed rows: ${r.failed.map((f) => `${f.row} (${f.error})`).join("; ")}` : ""}`); setCreds(r.credentials); reload(); }
          catch (er) { setMsg((er as Error).message); }
        }}>
          <input type="file" name="file" accept=".xlsx" required />
          <label className="check" style={{ padding: 0 }}><input type="checkbox" name="resetExisting" value="yes" /><span className="small">Also give new temporary passwords to students already on the list</span></label>
          <button className="btn" type="submit">Upload</button>
        </form>
      </Card>
      {creds && creds.length > 0 && <Credentials rows={creds} onClose={() => setCreds(null)} />}
      <div id="reports"><HodReports onError={setMsg} /></div>
      {msg && <div className="notice info" style={{ marginBottom: 12 }}>{msg}</div>}
      <div className="card">
        <Tabs value={status} onChange={setStatus} tabs={[["PENDING", "Waiting for verification"], ["VERIFIED", "Verified"], ["ACTIVE", "Active"], ["BLOCKED", "Deactivated"], ["ALL", "All"]]} />
        <input type="text" placeholder="Search name or roll number" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320, marginBottom: 12 }} />
        {!data ? <Loading error={error} /> : (
          <Table rows={data.students} empty="No students here." cols={[
            ["Name", (s) => <button className="btn ghost sm" onClick={async () => setOpen(await api<Detail>(`/api/students/${s.userId}`))}><b>{s.fullName}</b></button>],
            ["Roll number", (s) => s.rollNumber],
            ["Program", (s) => <span className="small">{s.program} · {s.semester}{s.section ?? ""}</span>],
            ["Campus / dept.", (s) => <span className="small">{s.campus?.name ?? s.campusName ?? ""} {s.department?.name ?? s.departmentName ? `· ${s.department?.name ?? s.departmentName}` : ""}{!s.department && s.departmentName && <> <a className="tiny" href="/departments">not on list</a></>}</span>],
            ["Contact", (s) => <span className="tiny">{s.user.email ?? s.user.phone}</span>],
            ["Status", (s) => <><Pill tone={s.user.status === "PENDING" ? "warn" : s.user.status === "BLOCKED" ? "bad" : undefined}>{s.user.status.toLowerCase()}</Pill>{s.rejectReason && <div className="tiny" style={{ color: "var(--bad)" }}>Asked to fix</div>}</>],
            ["Proof", (s) => s.user.uploads?.length ? <a className="small" href={`/api/uploads/${s.user.uploads[0].id}`} target="_blank" rel="noreferrer">View proof</a> : <span className="tiny muted">Uploaded by university</span>],
            ["Tests", (s) => s.user._count.attempts],
            ["Actions", (s) => (
              <div className="row">
                {s.user.status === "PENDING" && <button className="btn sm" onClick={() => act(s.userId, "verify")}>Verify</button>}
                {s.user.status === "PENDING" && <button className="btn sm sec" onClick={() => { const reason = window.prompt("What should the student correct?"); if (reason) act(s.userId, "reject", { reason }); }}>Ask to fix</button>}
                <button className="btn ghost sm" onClick={() => reset(s)}>Reset password</button>
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
            <button className="btn sm sec" type="button" onClick={() => download(`/api/reports/student?id=${open.user.profile.userId}`, `report-${open.user.profile.rollNumber}.pdf`).catch((er) => setMsg(er.message))}>Detailed report (PDF)</button>
          </form>
          <div className="grid g2">
            <div><h3>Subject accuracy</h3><table><tbody>{open.mastery.map((m) => <tr key={m.subject}><td>{SUBJECT_SHORT[m.subject]}</td><td><b>{Math.round((100 * m.correct) / (m.total || 1))}%</b></td><td className="tiny muted">{m.total} answers</td></tr>)}</tbody></table></div>
            <div><h3>Tests</h3><Table rows={open.attempts} cols={[["Type", (a) => a.type], ["Score", (a) => `${a.score}%`], ["Date", (a) => fmtDate(a.submittedAt)], ["Flags", (a) => a.flags.length ? <Pill tone="bad">{a.flags.length}</Pill> : ""]]} empty="No tests yet." /></div>
          </div>
          <PrepLog id={open.user.profile.userId} />
        </div>
      )}
    </Page>
  );
}

type Cred = { name: string; rollNumber: string; password: string; status: string };

/** Login details after a bulk upload or reset. Shown once: download or print before closing. */
function Credentials({ rows, onClose }: { rows: Cred[]; onClose: () => void }) {
  const csv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const body = ["name,roll_number,temporary_password", ...rows.map((r) => [r.name, r.rollNumber, r.password].map(esc).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    a.download = "student-logins.csv"; a.click();
  };
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Student logins</title><style>body{font-family:sans-serif}div{border:1px dashed #999;padding:10px;margin:6px;display:inline-block;width:300px}</style></head><body>${rows.map((r) => `<div><b>${r.name.replace(/</g, "&lt;")}</b><br>Login: your university + roll number <b>${r.rollNumber.replace(/</g, "&lt;")}</b><br>Temporary password: <b>${r.password}</b><br><small>Sign in at ${location.origin}/signin and set your own password.</small></div>`).join("")}</body></html>`);
    w.document.close(); w.print();
  };
  return (
    <Card title={`Login details for ${rows.length} student${rows.length > 1 ? "s" : ""}`} style={{ marginBottom: 16, borderColor: "var(--brand)" }}
      right={<div className="row"><button className="btn sm" onClick={csv}>Download CSV</button><button className="btn sm sec" onClick={print}>Print slips</button><button className="btn sm ghost" onClick={() => window.confirm("Close? These passwords are not shown again.") && onClose()}>Close</button></div>}>
      <p className="small muted" style={{ marginTop: 0 }}>These temporary passwords are shown only once. Students sign in with your university and their roll number, then set their own password.</p>
      <Table rows={rows.slice(0, 200)} cols={[["Name", (r) => r.name], ["Roll number", (r) => r.rollNumber], ["Temporary password", (r) => <code>{r.password}</code>], ["", (r) => <span className="tiny muted">{r.status}</span>]]} />
      {rows.length > 200 && <p className="tiny muted">Showing 200 of {rows.length}. The CSV has all of them.</p>}
    </Card>
  );
}

/** One PDF with a detailed page per student, filtered for a department, program or section, to share with HODs. */
function HodReports({ onError }: { onError: (m: string) => void }) {
  const scope = useApi<{ departments: { id: string; name: string; campus: { name: string } }[] }>("/api/labtests");
  const [busy, setBusy] = useState(false);
  return (
    <Card title="Detailed reports for HODs" style={{ marginBottom: 16 }}>
      <p className="small muted" style={{ marginTop: 0 }}>One page per student: readiness, subject accuracy against your university average, weakest and strongest topics, test history, integrity flags and next steps. Up to 300 students per file.</p>
      <form className="row" onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const q = new URLSearchParams({ pack: "1" });
        for (const k of ["departmentId", "program", "section"]) { const v = String(f.get(k) || "").trim(); if (v) q.set(k, v); }
        setBusy(true);
        try { await download(`/api/reports/student?${q}`, "student-reports.pdf"); } catch (er) { onError((er as Error).message); }
        setBusy(false);
      }}>
        <select name="departmentId" defaultValue=""><option value="">All departments</option>{scope.data?.departments.map((d) => <option key={d.id} value={d.id}>{d.campus.name} · {d.name}</option>)}</select>
        <input name="program" placeholder="Program (optional)" style={{ width: 200 }} />
        <input name="section" placeholder="Section" style={{ width: 90 }} />
        <button className="btn sec" disabled={busy} type="submit">{busy ? "Building PDF" : "Download report pack"}</button>
        <button className="btn ghost" type="button" onClick={() => download("/api/reports/university?format=pdf", "class-summary.pdf").catch((er) => onError(er.message))}>Class summary PDF</button>
      </form>
    </Card>
  );
}

type Act = {
  summary: { tests: number; prepSessions: number; mocks: number; minutes: number; videos: number; streakDays?: number; readiness?: number; bestMock?: number; lastActiveDay?: string | null };
  attempts: { id: string; type: string; label: string | null; score: number; correct: number; total: number; submittedAt: string; minutes: number; tabSwitches: number }[];
  videos: { at: string; video: { title: string; subject: string } | null }[];
};
const KIND: Record<string, string> = { PRACTICE: "Preparation level", MINI_MOCK: "Boss round", MOCK: "Mock test", DIAGNOSTIC: "Diagnostic", NATIONAL_MOCK: "National mock", LAB_TEST: "Lab test", MISTAKES: "Mistakes review" };

/** The student's preparation log: every level, mock and video, with time spent. */
function PrepLog({ id }: { id: string }) {
  const { data } = useApi<Act>(`/api/students/${id}/activity`, [id]);
  if (!data) return null;
  const s = data.summary;
  return (
    <div style={{ marginTop: 16 }}>
      <h3>Preparation log</h3>
      <div className="grid g4" style={{ marginBottom: 10 }}>
        <Stat k="Preparation sessions" v={s.prepSessions} />
        <Stat k="Mock tests" v={s.mocks} d={s.bestMock ? `best ${s.bestMock}%` : undefined} />
        <Stat k="Time on tests" v={`${Math.floor(s.minutes / 60)}h ${s.minutes % 60}m`} />
        <Stat k="Videos opened" v={s.videos} d={s.lastActiveDay ? `last active ${s.lastActiveDay}` : undefined} />
      </div>
      <Table rows={data.attempts.slice(0, 40)} empty="Nothing yet." cols={[
        ["When", (a) => <span className="tiny">{fmtDate(a.submittedAt)}</span>],
        ["Activity", (a) => <span className="small">{KIND[a.type] ?? a.type}{a.label ? `: ${a.label}` : ""}</span>],
        ["Score", (a) => <b>{a.score}%</b>],
        ["Time", (a) => <span className="tiny">{a.minutes} min</span>],
        ["Tab switches", (a) => (a.tabSwitches ? <Pill tone="warn">{a.tabSwitches}</Pill> : "")],
      ]} />
      {data.videos.length > 0 && <p className="tiny muted">Recent videos: {data.videos.slice(0, 6).map((v) => v.video?.title).filter(Boolean).join(", ")}</p>}
    </div>
  );
}
