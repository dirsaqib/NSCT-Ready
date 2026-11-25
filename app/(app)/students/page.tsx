"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, SUBJECT_SHORT } from "@/components/api";
import { Page, Card, Stat, useApi, Loading, Table, Pill, Tabs, fmtDate, download, upload } from "@/components/ui";

type S = {
  userId: string; fullName: string; rollNumber: string; program: string; semester: string; section: string | null; rejectReason: string | null; extraTimePct: number;
  readiness: number; createdAt: string; campus: { name: string } | null; department: { name: string } | null; campusName?: string | null; departmentName?: string | null; gender?: string | null;
  user: { id: string; email: string | null; phone: string | null; status: string; lastSeenAt: string | null; uploads?: { id: string; filename: string }[]; _count: { attempts: number } };
  mocks?: Record<string, { best: number; tries: number }>;
};
type Detail = { user: { email: string | null; phone: string | null; status: string; profile: S }; mastery: { subject: string; correct: number; total: number }[]; topics: { subject: string; topic: string; correct: number; total: number }[]; attempts: { id: string; type: string; score: number; percentile: number | null; submittedAt: string; tabSwitches: number; flags: string[] }[] };

export default function StudentsPage() { return <Suspense fallback={<div className="spin" />}><Students /></Suspense>; }

/** Verification queue, student records, bulk upload and per-student reports. */
function Students() {
  const initial = useSearchParams().get("status") ?? "ALL";
  const [status, setStatus] = useState(initial);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [sort, setSort] = useState("roll");
  const [mock, setMock] = useState("");
  const { data, error, reload } = useApi<{ total: number; all: number; tookMock: number; departments: { id: string | null; name: string; students: number; tookMock: number }[]; students: S[] }>(`/api/students?status=${status === "ALL" ? "" : status}&q=${encodeURIComponent(q)}&departmentId=${dept}&sort=${sort}&mock=${mock}`, [status, q, dept, sort, mock]);
  const [open, setOpen] = useState<Detail | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [askRemove, setAskRemove] = useState(false);
  async function bulk(action: "remove" | "deactivate" | "activate") {
    try {
      const r = await api<{ removed?: number; deactivated?: number; changed?: number }>("/api/students/bulk", { method: "POST", body: { ids: picked, action } });
      setMsg(action === "remove" ? `Removed ${r.removed ?? 0}${r.deactivated ? `, deactivated ${r.deactivated} who had already practised` : ""}.` : `Updated ${r.changed ?? 0} students.`);
      setPicked([]); setAskRemove(false); reload();
    } catch (er) { setMsg((er as Error).message); }
  }
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
          try { const r = await upload<{ created: number; updated: number; updatedRows?: { row: number; name: string; rollNumber: string; reason: string }[]; warnings?: { row: number; note: string }[]; failed: { row: number; error: string }[]; credentials: Cred[] }>("/api/students/import", fd); setMsg(`Added ${r.created} new, updated ${r.updated} already registered${r.failed.length ? `, ${r.failed.length} rows skipped` : ""}.${r.updatedRows?.length ? ` Updated: ${r.updatedRows.map((x) => `row ${x.row} ${x.name} (${x.rollNumber}): ${x.reason}`).join(" | ")}` : ""}${r.warnings?.length ? ` Note: ${r.warnings.map((w) => `row ${w.row}: ${w.note}`).join(" | ")}` : ""}${r.failed.length ? ` Skipped: ${r.failed.map((f) => `row ${f.row}: ${f.error}`).join(" | ")}` : ""}`); setCreds(r.credentials); reload(); }
          catch (er) { setMsg((er as Error).message); }
        }}>
          <input type="file" name="file" accept=".xlsx" required />
          <label className="check" style={{ padding: 0 }}><input type="checkbox" name="resetExisting" value="yes" /><span className="small">Also give new temporary passwords to students already on the list</span></label>
          <button className="btn" type="submit">Upload</button>
        </form>
      </Card>
      {creds && creds.length > 0 && <Credentials rows={creds} onClose={() => setCreds(null)} />}
      <RecentUploads onDone={(m) => { setMsg(m); reload(); }} />
      <div id="reports"><HodReports onError={setMsg} /></div>
      {msg && <div className="notice info" style={{ marginBottom: 12 }}>{msg}</div>}
      <div className="card">
        <Tabs value={status} onChange={setStatus} tabs={[["PENDING", "Waiting for verification"], ["VERIFIED", "Verified"], ["ACTIVE", "Active"], ["BLOCKED", "Deactivated"], ["ALL", "All"]]} />
        {data && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "4px 0 12px" }}>
            <span className="pill" style={{ fontSize: 13, padding: "6px 12px" }}><b>{data.all}</b>&nbsp;students in total</span>
            <span className="pill" style={{ fontSize: 13, padding: "6px 12px", background: "#DDF7EE", color: "#0B7A5E" }}><b>{data.tookMock}</b>&nbsp;took a mock</span>
            <span className="pill warn" style={{ fontSize: 13, padding: "6px 12px" }}><b>{data.all - data.tookMock}</b>&nbsp;no mock yet</span>
            {data.departments.length > 1 && data.departments.map((d) => (
              <button key={d.id ?? "none"} type="button" onClick={() => setDept(dept === (d.id ?? "") ? "" : d.id ?? "")} className="pill" style={{ fontSize: 12.5, padding: "6px 12px", cursor: d.id ? "pointer" : "default", border: dept === d.id ? "2px solid var(--brand)" : "1px solid var(--line)", background: "#fff" }}>
                {d.name}: <b>&nbsp;{d.students}</b>&nbsp;<span className="muted">({d.tookMock} took a mock)</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <input type="text" placeholder="Search name or roll number" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
          {data && data.departments.length > 1 && <select value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All departments</option>{data.departments.filter((d) => d.id).map((d) => <option key={d.id!} value={d.id!}>{d.name} ({d.students})</option>)}</select>}
          <select value={mock} onChange={(e) => setMock(e.target.value)}><option value="">Mock: everyone</option><option value="taken">Took a mock</option><option value="none">Has not taken a mock</option></select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="roll">Sort by roll number</option><option value="name">Sort by name</option><option value="new">Newest first</option></select>
          {data && <span className="small muted" style={{ marginLeft: "auto" }}>Showing {data.students.length} of {data.total}</span>}
        </div>
        {picked.length > 0 && (
          <div className="notice info" style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <b>{picked.length} selected</b>
            <button className="btn sm sec" onClick={() => bulk("deactivate")}>Deactivate selected</button>
            <button className="btn sm sec" onClick={() => bulk("activate")}>Activate selected</button>
            {!askRemove ? <button className="btn sm" style={{ background: "var(--bad)" }} onClick={() => setAskRemove(true)}>Remove selected</button> : (
              <span className="row"><span className="small"><b>Remove {picked.length} students?</b> This cannot be undone.</span><button className="btn sm" style={{ background: "var(--bad)" }} onClick={() => bulk("remove")}>Yes, remove</button><button className="btn sm sec" onClick={() => setAskRemove(false)}>Cancel</button></span>
            )}
            <button className="btn sm ghost" onClick={() => { setPicked([]); setAskRemove(false); }}>Clear</button>
          </div>
        )}
        {!data ? <Loading error={error} /> : (
          <Table rows={data.students} empty="No students here." cols={[
            [<input key="all" type="checkbox" aria-label="Select all on this page" checked={data.students.length > 0 && data.students.every((s) => picked.includes(s.userId))} onChange={(e) => setPicked(e.target.checked ? [...new Set([...picked, ...data.students.map((s) => s.userId)])] : picked.filter((id) => !data.students.some((s) => s.userId === id)))} /> as unknown as string, (s) => <input type="checkbox" aria-label={`Select ${s.fullName}`} checked={picked.includes(s.userId)} onChange={(e) => setPicked(e.target.checked ? [...picked, s.userId] : picked.filter((id) => id !== s.userId))} />],
            ["#", (s) => <span className="tiny muted">{data.students.indexOf(s) + 1}</span>],
            ["Name", (s) => <button className="btn ghost sm" onClick={async () => setOpen(await api<Detail>(`/api/students/${s.userId}`))}><b>{s.fullName}</b></button>],
            ["Roll number", (s) => s.rollNumber],
            ["Program", (s) => <span className="small">{s.program} · {s.semester}{s.section ?? ""}</span>],
            ["Campus / dept.", (s) => <span className="small">{s.campus?.name ?? s.campusName ?? ""} {s.department?.name ?? s.departmentName ? `· ${s.department?.name ?? s.departmentName}` : ""}{!s.department && s.departmentName && <> <a className="tiny" href="/departments">not on list</a></>}</span>],
            ["Contact", (s) => <span className="tiny">{s.user.email ?? s.user.phone}</span>],
            ["Status", (s) => <><Pill tone={s.user.status === "PENDING" ? "warn" : s.user.status === "BLOCKED" ? "bad" : undefined}>{s.user.status.toLowerCase()}</Pill>{s.rejectReason && <div className="tiny" style={{ color: "var(--bad)" }}>Asked to fix</div>}</>],
            ["Proof", (s) => s.user.uploads?.length ? <a className="small" href={`/api/uploads/${s.user.uploads[0].id}`} target="_blank" rel="noreferrer">View proof</a> : <span className="tiny muted">Uploaded by university</span>],
            ["Mock 1", (s) => mockCell(s.mocks?.["Mock 1"])],
            ["Mock 2", (s) => mockCell(s.mocks?.["Mock 2"])],
            ["Mock 3", (s) => mockCell(s.mocks?.["Mock 3"])],
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
/** Best score in a mock, or a grey "not taken". */
function mockCell(m?: { best: number; tries: number }) {
  if (!m) return <span className="tiny" style={{ color: "#9AA6C2" }}>not taken</span>;
  const c = m.best >= 70 ? ["#D9F3E8", "#0B7A5E"] : m.best >= 50 ? ["#FFF1D6", "#8A5A0B"] : ["#FBE0DC", "#B3372D"];
  return <span title={`${m.tries} attempt${m.tries > 1 ? "s" : ""}, best score`} style={{ background: c[0], color: c[1], padding: "3px 8px", borderRadius: 8, fontWeight: 800, fontSize: 12 }}>{m.best}%</span>;
}

type Batch = { id: string; filename: string | null; created: number; updated: number; createdAt: string; undoneAt: string | null; canUndo: boolean };
/** Recent Excel uploads with an Undo button, for when the wrong file was uploaded. */
function RecentUploads({ onDone }: { onDone: (m: string) => void }) {
  const { data, reload } = useApi<{ rows: Batch[] }>("/api/students/import/undo");
  const [busy, setBusy] = useState("");
  if (!data || !data.rows.length) return null;
  return (
    <Card title="Recent uploads" style={{ marginBottom: 16 }}>
      <p className="small muted" style={{ marginTop: 0 }}>Uploaded the wrong file? Undo removes the students that upload added (within 7 days). Students who already practised are deactivated instead, so nothing they did is lost. To fix spellings or sections, just upload the corrected file again: students with the same roll number are updated, not added twice.</p>
      <Table rows={data.rows} cols={[
        ["When", (b) => fmtDate(b.createdAt)], ["File", (b) => b.filename ?? "Excel file"], ["Added", (b) => b.created], ["Updated", (b) => b.updated],
        ["", (b) => b.undoneAt ? <Pill tone="grey">Undone</Pill> : b.canUndo ? (
          <button className="btn sm sec" disabled={busy === b.id} onClick={async () => {
            if (busy) return; setBusy(b.id);
            try { const r = await api<{ removed: number; deactivated: number }>("/api/students/import/undo", { method: "POST", body: { batchId: b.id } }); onDone(`Upload undone: ${r.removed} removed${r.deactivated ? `, ${r.deactivated} deactivated because they had already practised` : ""}.`); reload(); }
            catch (er) { onDone((er as Error).message); } finally { setBusy(""); }
          }}>{busy === b.id ? "Undoing…" : "Undo this upload"}</button>
        ) : <span className="small muted">–</span>],
      ]} />
    </Card>
  );
}

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
