"use client";
import { useState } from "react";
import { api } from "./api";
import { Page, useApi, Loading, Pill, fmtDateTime } from "./ui";

type T = { id: string; subject: string; category: string; status: string; messages: { id: string; body: string; staff: boolean; createdAt: string }[] };

export default function TicketThread({ id }: { id: string }) {
  const { data, error, reload } = useApi<{ ticket: T }>(`/api/tickets/${id}`);
  const [body, setBody] = useState("");
  if (!data) return <Loading error={error} />;
  const t = data.ticket;
  return (
    <Page title={t.subject} sub={`${t.category} · ${t.status.toLowerCase()}`} actions={t.status !== "CLOSED" && <button className="btn sec sm" onClick={async () => { await api(`/api/tickets/${id}`, { method: "PATCH", body: { status: "CLOSED" } }); reload(); }}>Close ticket</button>}>
      {t.messages.map((m) => (
        <div className="card" key={m.id} style={{ marginBottom: 10, borderColor: m.staff ? "var(--brand)" : undefined }}>
          <div className="row between"><b className="small">{m.staff ? <>Support team <Pill>Staff</Pill></> : "You"}</b><span className="tiny muted">{fmtDateTime(m.createdAt)}</span></div>
          <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{m.body}</div>
        </div>
      ))}
      <form className="card grid" style={{ gap: 10 }} onSubmit={async (e) => { e.preventDefault(); await api(`/api/tickets/${id}`, { body: { body } }); setBody(""); reload(); }}>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} required placeholder="Write a reply" />
        <div><button className="btn" type="submit">Send</button></div>
      </form>
    </Page>
  );
}
