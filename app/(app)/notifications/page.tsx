"use client";
import Link from "next/link";
import { useEffect } from "react";
import { api } from "@/components/api";
import { Page, useApi, Loading, fmtDateTime } from "@/components/ui";

type N = { id: string; title: string; body: string; link: string | null; status: string; createdAt: string };

export default function Notifications() {
  const { data, error } = useApi<{ items: N[] }>("/api/notifications");
  useEffect(() => { if (data?.items.some((i) => i.status !== "READ")) api("/api/notifications", { method: "PATCH", body: {} }).catch(() => {}); }, [data]);
  if (!data) return <Loading error={error} />;
  return (
    <Page title="Notifications">
      <div className="card qlist">
        {data.items.map((n) => (
          <div className="q" key={n.id} style={{ opacity: n.status === "READ" ? 0.75 : 1 }}>
            <div className="row between"><b>{n.title}</b><span className="tiny muted">{fmtDateTime(n.createdAt)}</span></div>
            <div className="small">{n.body}</div>
            {n.link && <Link className="small" href={n.link}>Open</Link>}
          </div>
        ))}
        {!data.items.length && <div className="empty">No notifications yet.</div>}
      </div>
    </Page>
  );
}
