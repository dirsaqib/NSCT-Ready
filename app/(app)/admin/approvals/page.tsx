"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Page, useApi, Loading, Table, Pill, Tabs, fmtDate } from "@/components/ui";

type F = {
  id: string; name: string | null; email: string | null; phone: string | null; designation: string | null; status: string; createdAt: string; lastSeenAt: string | null; totpEnabled: boolean;
  university: { name: string } | null; campus: { name: string } | null; uploads: { id: string; filename: string }[];
};

/** Super admin: approve focal person registrations and manage their accounts. */
export default function Approvals() {
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "ALL">("PENDING");
  const { data, error, reload } = useApi<{ focals: F[] }>(`/api/admin/focals?status=${status}`, [status]);
  const [msg, setMsg] = useState("");
  const act = async (f: F, action: string, extra: object = {}) => {
    try {
      const r = await api<{ tempPassword?: string }>("/api/admin/focals", { method: "PATCH", body: { id: f.id, action, ...extra } });
      setMsg(r.tempPassword ? `Temporary password for ${f.name}: ${r.tempPassword} (shown once, they must change it at sign-in)` : "Done.");
      reload();
    } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <Page title="Focal person approvals" sub="Check each registration and its proof before approving. Approved focal persons see only their own university.">
      <div className="card">
        <Tabs value={status} onChange={setStatus} tabs={[["PENDING", "Waiting for approval"], ["APPROVED", "Approved"], ["ALL", "All"]]} />
        {msg && <div className="notice info" style={{ marginBottom: 12 }}>{msg}</div>}
        {!data ? <Loading error={error} /> : (
          <Table rows={data.focals} empty="No focal persons here." cols={[
            ["Name", (f) => <><b>{f.name}</b><div className="tiny muted">{f.designation}</div></>],
            ["University", (f) => <span className="small">{f.university?.name}{f.campus ? ` · ${f.campus.name}` : ""}</span>],
            ["Contact", (f) => <span className="tiny">{f.email}<br />{f.phone}</span>],
            ["Proof", (f) => f.uploads[0] ? <a className="small" href={`/api/uploads/${f.uploads[0].id}`} target="_blank" rel="noreferrer">View proof</a> : <span className="tiny muted">None</span>],
            ["Registered", (f) => <span className="tiny">{fmtDate(f.createdAt)}</span>],
            ["Status", (f) => <><Pill tone={f.status === "PENDING" ? "warn" : f.status === "BLOCKED" ? "bad" : undefined}>{f.status.toLowerCase()}</Pill>{f.status !== "PENDING" && <div className="tiny muted">2FA {f.totpEnabled ? "on" : "not set"}</div>}</>],
            ["Actions", (f) => (
              <div className="row">
                {f.status === "PENDING" && <button className="btn sm" onClick={() => act(f, "approve")}>Approve</button>}
                {f.status === "PENDING" && <button className="btn sm sec" onClick={() => { const reason = window.prompt("Reason for rejecting (sent to them)"); if (reason) act(f, "reject", { reason }); }}>Reject</button>}
                {f.status !== "PENDING" && <button className="btn ghost sm" onClick={() => window.confirm("Reset this focal person's password?") && act(f, "resetPassword")}>Reset password</button>}
                {f.status !== "PENDING" && f.totpEnabled && <button className="btn ghost sm" onClick={() => window.confirm("Clear two-factor so they can set it up again on a new phone?") && act(f, "reset2fa")}>Reset 2FA</button>}
                {f.status !== "PENDING" && (f.status === "BLOCKED" ? <button className="btn ghost sm" onClick={() => act(f, "unblock")}>Unblock</button> : <button className="btn ghost sm" onClick={() => window.confirm("Block this focal person?") && act(f, "block")}>Block</button>)}
              </div>
            )],
          ]} />
        )}
      </div>
    </Page>
  );
}
