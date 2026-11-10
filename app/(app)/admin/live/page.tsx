"use client";
import { useEffect } from "react";
import { Page, Card, Stat, useApi, Loading, Table, fmtDateTime } from "@/components/ui";

type L = { at: string; online: number; testsInProgress: number; inProgressByType: { type: string; n: number }[]; notifications: { queued: number; failedLast24h: number }; system: { load1: number; cpus: number; memUsedPct: number; uptimeHours: number; dbLatencyMs: number } };

/** Live activity, refreshed every 10 seconds. */
export default function Live() {
  const { data: d, error, reload } = useApi<L>("/api/admin/live");
  useEffect(() => { const t = setInterval(reload, 10000); return () => clearInterval(t); }, [reload]);
  if (!d) return <Loading error={error} />;
  const s = d.system;
  return (
    <Page title="Live activity" sub={`Updated ${fmtDateTime(d.at)}. Refreshes every 10 seconds.`}>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat k="Online now" v={d.online} d="seen in the last 5 minutes" />
        <Stat k="Tests in progress" v={d.testsInProgress} />
        <Stat k="Messages queued" v={d.notifications.queued} d={`${d.notifications.failedLast24h} failed in 24 hours`} />
        <Stat k="Database" v={`${s.dbLatencyMs} ms`} d="query time" />
      </div>
      <div className="grid g2">
        <Card title="Tests in progress by type"><Table rows={d.inProgressByType} empty="No tests running." cols={[["Type", (r) => r.type.toLowerCase().replace("_", " ")], ["Running", (r) => r.n]]} /></Card>
        <Card title="Server">
          <Table rows={[["Load (1 min)", `${s.load1.toFixed(2)} on ${s.cpus} CPUs`], ["Memory used", `${s.memUsedPct}%`], ["Uptime", `${s.uptimeHours} hours`]]} cols={[["Measure", (r) => r[0]], ["Value", (r) => <b>{r[1]}</b>]]} />
          {(s.load1 / s.cpus > 0.8 || s.memUsedPct > 85) && <div className="notice bad">The server is under heavy load. Scale up before the next national mock.</div>}
        </Card>
      </div>
    </Page>
  );
}
