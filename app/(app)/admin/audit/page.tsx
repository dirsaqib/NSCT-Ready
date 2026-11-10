"use client";
import { useState } from "react";
import { Page, Card, useApi, Loading, Table, fmtDateTime } from "@/components/ui";

type R = { id: string; action: string; target: string | null; meta: unknown; ip: string | null; createdAt: string; actor: { email: string | null; role: string } | null };

/** Who did what, when. Kept for every staff action, sign-in and data export. */
export default function Audit() {
  const [f, setF] = useState({ action: "", target: "", page: 0 });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== "").map(([k, v]) => [k, String(v)])).toString();
  const { data, error } = useApi<{ total: number; rows: R[] }>(`/api/admin/audit?${qs}`, [qs]);
  return (
    <Page title="Audit log" sub="Every staff action, export and sign-in, kept for review.">
      <Card>
        <div className="row" style={{ marginBottom: 12 }}>
          <input type="text" placeholder="Action starts with, e.g. student. or question." value={f.action} onChange={(e) => setF({ ...f, action: e.target.value, page: 0 })} style={{ maxWidth: 300 }} />
          <input type="text" placeholder="Target id" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value, page: 0 })} style={{ maxWidth: 220 }} />
        </div>
        {!data ? <Loading error={error} /> : (
          <>
            <Table rows={data.rows} cols={[["When", (r) => fmtDateTime(r.createdAt)], ["Who", (r) => <>{r.actor?.email ?? "System"}<div className="tiny muted">{r.actor?.role.toLowerCase()}</div></>], ["Action", (r) => <code>{r.action}</code>], ["Target", (r) => <span className="tiny">{r.target}</span>], ["Details", (r) => <span className="tiny muted">{r.meta ? JSON.stringify(r.meta).slice(0, 120) : ""}</span>], ["IP", (r) => <span className="tiny">{r.ip}</span>]]} />
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn sec sm" disabled={f.page === 0} onClick={() => setF({ ...f, page: f.page - 1 })}>Newer</button>
              <span className="small muted">Page {f.page + 1} of {Math.max(1, Math.ceil(data.total / 100))}</span>
              <button className="btn sec sm" disabled={(f.page + 1) * 100 >= data.total} onClick={() => setF({ ...f, page: f.page + 1 })}>Older</button>
            </div>
          </>
        )}
      </Card>
    </Page>
  );
}
