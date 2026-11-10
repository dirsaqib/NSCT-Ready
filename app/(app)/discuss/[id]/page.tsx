"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Page, useApi, Loading, Pill, fmtDateTime } from "@/components/ui";

type P = { id: string; body: string; isInstructor: boolean; createdAt: string; user: { role: string; profile: { alias: string | null; fullName: string } | null } };
type T = { id: string; title: string; body: string; resolved: boolean; createdAt: string; posts: P[] };

export default function Thread({ params }: { params: { id: string } }) {
  const { data, error, reload } = useApi<{ thread: T }>(`/api/threads/${params.id}`);
  const [body, setBody] = useState("");
  if (!data) return <Loading error={error} />;
  const t = data.thread;
  return (
    <Page title={t.title} actions={<button className="btn sec sm" onClick={async () => { await api(`/api/threads/${t.id}`, { method: "PATCH", body: {} }); reload(); }}>{t.resolved ? "Mark as open" : "Mark as resolved"}</button>}>
      <div className="card" style={{ marginBottom: 12 }}><div style={{ whiteSpace: "pre-wrap" }}>{t.body}</div></div>
      {t.posts.map((p) => (
        <div className="card" key={p.id} style={{ marginBottom: 10, borderColor: p.isInstructor ? "var(--brand)" : undefined }}>
          <div className="row between"><b className="small">{p.user.profile?.alias || p.user.profile?.fullName || "Staff"} {p.isInstructor && <Pill>Instructor</Pill>}</b><span className="tiny muted">{fmtDateTime(p.createdAt)}</span></div>
          <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{p.body}</div>
        </div>
      ))}
      <form className="card grid" style={{ gap: 10 }} onSubmit={async (e) => { e.preventDefault(); await api(`/api/threads/${t.id}`, { body: { body } }); setBody(""); reload(); }}>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} required placeholder="Write a reply" />
        <div><button className="btn" type="submit">Reply</button></div>
      </form>
    </Page>
  );
}
