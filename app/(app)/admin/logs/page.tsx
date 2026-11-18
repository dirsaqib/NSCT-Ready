"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/components/api";
import { Page, Card, Stat, useApi, Loading, Table, Tabs, Pill, fmtDateTime } from "@/components/ui";

type Health = {
  errors24: number; errorsByPath: { path: string; _count: number }[]; signinOk: number; signinFail: number;
  locked: { id: string; email: string | null; name: string | null; role: string; lockedUntil: string }[];
  pendingStudents: number; pendingFocals: number; mustChange: number; queued: number; failedNotices: number;
  users: { role: string; status: string; _count: number }[]; attempts24: number;
};
type Err = { id: string; path: string; method: string; message: string; stack: string | null; createdAt: string };
type Sign = { id: string; action: string; ip: string | null; createdAt: string; actor: { email: string | null; role: string; name: string | null; profile: { rollNumber: string } | null } | null };

/** Super admin logs: system health, server errors and every sign-in, so issues are caught early. */
export default function Logs() {
  const [tab, setTab] = useState<"health" | "errors" | "signins" | "fails">("health");
  const view = tab === "fails" ? "signins&fail=1" : tab;
  const { data, error, reload } = useApi<Health & { rows: (Err & Sign)[] }>(`/api/admin/logs?view=${view}`, [tab]);
  const [open, setOpen] = useState<string | null>(null);
  const post = async (body: object) => { await api("/api/admin/logs", { body }).catch((e) => alert(e.message)); reload(); };
  return (
    <Page title="System logs" sub="Health, errors and sign-ins in one place. Check this page daily during exam season."
      actions={<Link className="btn sec" href="/admin/audit">Full audit log</Link>}>
      <Tabs value={tab} onChange={setTab} tabs={[["health", "Health"], ["errors", "Server errors"], ["signins", "Sign-ins"], ["fails", "Failed sign-ins"]]} />
      {!data ? <Loading error={error} /> : tab === "health" ? (
        <>
          <div className="grid g4" style={{ marginBottom: 16 }}>
            <Stat k="Server errors, 24 h" v={<span style={{ color: data.errors24 ? "var(--bad)" : undefined }}>{data.errors24}</span>} />
            <Stat k="Sign-ins, 24 h" v={data.signinOk} d={`${data.signinFail} failed`} />
            <Stat k="Tests started, 24 h" v={data.attempts24} />
            <Stat k="Notifications waiting" v={data.queued} d={`${data.failedNotices} failed today`} />
          </div>
          <div className="grid g4" style={{ marginBottom: 16 }}>
            <Stat k="Students waiting for focal" v={data.pendingStudents} />
            <Stat k="Focal persons to approve" v={<Link href="/admin/approvals">{data.pendingFocals}</Link>} />
            <Stat k="Temporary passwords not yet changed" v={data.mustChange} />
            <Stat k="Locked accounts" v={data.locked.length} />
          </div>
          <div className="grid g2">
            <Card title="Where errors happen (24 h)">
              <Table rows={data.errorsByPath} empty="No errors. All good." cols={[["Path", (r) => <code className="small">{r.path}</code>], ["Errors", (r) => <Pill tone="bad">{r._count}</Pill>]]} />
            </Card>
            <Card title="Locked accounts">
              <Table rows={data.locked} empty="None." cols={[["User", (r) => <span className="small">{r.name ?? r.email}</span>], ["Role", (r) => r.role], ["Until", (r) => <span className="tiny">{fmtDateTime(r.lockedUntil)}</span>], ["", (r) => <button className="btn sm ghost" onClick={() => post({ action: "unlock", id: r.id })}>Unlock</button>]]} />
            </Card>
          </div>
          <Card title="Accounts by role and status" style={{ marginTop: 16 }}>
            <Table rows={data.users} cols={[["Role", (r) => r.role], ["Status", (r) => r.status.toLowerCase()], ["Accounts", (r) => r._count]]} />
          </Card>
        </>
      ) : tab === "errors" ? (
        <Card title={`${data.rows.length} most recent server errors`} right={<button className="btn sm ghost" onClick={() => post({ action: "clearErrors" })}>Clear older than 7 days</button>}>
          <Table rows={data.rows} empty="No server errors recorded." cols={[
            ["When", (r) => <span className="tiny">{fmtDateTime(r.createdAt)}</span>],
            ["Request", (r) => <code className="small">{r.method} {r.path}</code>],
            ["Error", (r) => <div><button className="btn ghost sm" style={{ textAlign: "left" }} onClick={() => setOpen(open === r.id ? null : r.id)}>{r.message.slice(0, 140)}</button>{open === r.id && r.stack && <pre className="code tiny" style={{ whiteSpace: "pre-wrap" }}>{r.stack}</pre>}</div>],
          ]} />
        </Card>
      ) : (
        <Card title={tab === "fails" ? "Wrong passwords" : "Sign-ins"}>
          <Table rows={data.rows} empty="Nothing yet." cols={[
            ["When", (r) => <span className="tiny">{fmtDateTime(r.createdAt)}</span>],
            ["User", (r) => <span className="small">{r.actor?.name ?? ""} {r.actor?.email ?? r.actor?.profile?.rollNumber ?? ""}</span>],
            ["Role", (r) => r.actor?.role ?? ""],
            ["Result", (r) => r.action === "signin.ok" ? <Pill>ok</Pill> : <Pill tone="bad">wrong password</Pill>],
            ["IP", (r) => <span className="tiny">{r.ip ?? ""}</span>],
          ]} />
        </Card>
      )}
    </Page>
  );
}
