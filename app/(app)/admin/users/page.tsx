"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Page, Card, useApi, Loading, Table, Pill, fmtDate } from "@/components/ui";

const ROLES = ["STUDENT", "FACULTY", "HOD", "CAMPUS_ADMIN", "FOCAL", "CHAIR", "GOV", "EMPLOYER", "SPONSOR", "ADMIN"];
const STATUSES = ["PENDING", "VERIFIED", "ACTIVE", "BLOCKED"];
type U = { id: string; email: string | null; phone: string | null; role: string; status: string; totpEnabled: boolean; lastSeenAt: string | null; createdAt: string; proUntil: string | null; universityId: string | null; campusId: string | null; departmentId: string | null; employerId: string | null; sponsorId: string | null; university: { name: string } | null; profile: { fullName: string; rollNumber: string } | null };
type Uni = { id: string; name: string; campuses: { id: string; name: string; departments: { id: string; name: string }[] }[] };

/** Every user. Assign roles and their place in the hierarchy, approve or block, reset 2FA, grant Pro. */
export default function Users() {
  const [f, setF] = useState({ q: "", role: "", status: "", page: 0 });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== "").map(([k, v]) => [k, String(v)])).toString();
  const { data, error, reload } = useApi<{ total: number; users: U[] }>(`/api/admin/users?${qs}`, [qs]);
  const structure = useApi<{ universities: Uni[] }>("/api/admin/structure");
  const biz = useApi<{ employers: { id: string; name: string }[]; sponsors: { id: string; name: string }[] }>("/api/admin/business");
  const [edit, setEdit] = useState<U | null>(null);
  const patch = async (id: string, body: object) => { await api(`/api/admin/users/${id}`, { method: "PATCH", body }).catch((e) => alert(e.message)); reload(); };
  const uni = structure.data?.universities.find((u) => u.id === edit?.universityId);
  const campus = uni?.campuses.find((c) => c.id === edit?.campusId);
  return (
    <Page title="Users and roles" sub={data ? `${data.total.toLocaleString()} users` : ""}>
      <div className="row" style={{ marginBottom: 12 }}>
        <input type="text" placeholder="Name, email, phone or roll number" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value, page: 0 })} style={{ maxWidth: 300 }} />
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value, page: 0 })} style={{ width: "auto" }}><option value="">All roles</option>{ROLES.map((r) => <option key={r} value={r}>{r.toLowerCase().replace("_", " ")}</option>)}</select>
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, page: 0 })} style={{ width: "auto" }}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</select>
      </div>
      {edit && (
        <Card title={`Edit ${edit.profile?.fullName ?? edit.email ?? edit.phone}`} style={{ marginBottom: 16, borderColor: "var(--brand)" }}>
          <div className="grid g4">
            <label className="f">Role<select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{r.toLowerCase().replace("_", " ")}</option>)}</select></label>
            <label className="f">Status<select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</select></label>
            <label className="f">University<select value={edit.universityId ?? ""} onChange={(e) => setEdit({ ...edit, universityId: e.target.value || null, campusId: null, departmentId: null })}><option value="">None</option>{structure.data?.universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
            <label className="f">Campus (campus admin)<select value={edit.campusId ?? ""} onChange={(e) => setEdit({ ...edit, campusId: e.target.value || null, departmentId: null })}><option value="">Whole university</option>{uni?.campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="f">Department (HOD, faculty)<select value={edit.departmentId ?? ""} onChange={(e) => setEdit({ ...edit, departmentId: e.target.value || null })}><option value="">Whole campus</option>{campus?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            {edit.role === "EMPLOYER" && <label className="f">Employer<select value={edit.employerId ?? ""} onChange={(e) => setEdit({ ...edit, employerId: e.target.value || null })}><option value="">Choose</option>{biz.data?.employers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
            {edit.role === "SPONSOR" && <label className="f">Sponsor<select value={edit.sponsorId ?? ""} onChange={(e) => setEdit({ ...edit, sponsorId: e.target.value || null })}><option value="">Choose</option>{biz.data?.sponsors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
            <label className="f">Pro until<input type="date" value={edit.proUntil?.slice(0, 10) ?? ""} onChange={(e) => setEdit({ ...edit, proUntil: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={async () => { await patch(edit.id, { role: edit.role, status: edit.status, universityId: edit.universityId, campusId: edit.campusId, departmentId: edit.departmentId, employerId: edit.employerId, sponsorId: edit.sponsorId, proUntil: edit.proUntil }); setEdit(null); }}>Save</button>
            {edit.totpEnabled && <button className="btn sec" onClick={() => window.confirm("Reset two-factor? The user must set it up again.") && patch(edit.id, { reset2fa: true })}>Reset two-factor</button>}
            <button className="btn ghost" onClick={() => setEdit(null)}>Cancel</button>
          </div>
          <p className="tiny muted">Staff roles need two-factor sign-in. Every change is written to the audit log.</p>
        </Card>
      )}
      <div className="card">
        {!data ? <Loading error={error} /> : (
          <>
            <Table rows={data.users} cols={[
              ["User", (u) => <><b>{u.profile?.fullName ?? u.email ?? u.phone}</b><div className="tiny muted">{u.email ?? u.phone}{u.profile ? ` · ${u.profile.rollNumber}` : ""}</div></>],
              ["Role", (u) => <Pill tone="grey">{u.role.toLowerCase().replace("_", " ")}</Pill>],
              ["Status", (u) => <Pill tone={u.status === "BLOCKED" ? "bad" : u.status === "PENDING" ? "warn" : undefined}>{u.status.toLowerCase()}</Pill>],
              ["University", (u) => <span className="small">{u.university?.name}</span>],
              ["2FA", (u) => (u.totpEnabled ? "On" : "")], ["Pro", (u) => (u.proUntil && new Date(u.proUntil) > new Date() ? fmtDate(u.proUntil) : "")],
              ["Last seen", (u) => fmtDate(u.lastSeenAt)],
              ["", (u) => <div className="row"><button className="btn sm sec" onClick={() => setEdit(u)}>Edit</button>{u.status === "BLOCKED" ? <button className="btn sm ghost" onClick={() => patch(u.id, { status: "ACTIVE" })}>Unblock</button> : <button className="btn sm ghost" onClick={() => window.confirm("Block this user?") && patch(u.id, { status: "BLOCKED" })}>Block</button>}</div>],
            ]} />
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn sec sm" disabled={f.page === 0} onClick={() => setF({ ...f, page: f.page - 1 })}>Previous</button>
              <span className="small muted">Page {f.page + 1} of {Math.max(1, Math.ceil(data.total / 100))}</span>
              <button className="btn sec sm" disabled={(f.page + 1) * 100 >= data.total} onClick={() => setF({ ...f, page: f.page + 1 })}>Next</button>
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
