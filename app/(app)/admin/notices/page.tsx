"use client";
import { api } from "@/components/api";
import { Page, Card, useApi, Loading, JsonForm, fmtDate } from "@/components/ui";

type N = { id: string; title: string; body: string; due: string | null; channels: string[]; createdAt: string };

/** Announcements to students in the sender's scope, on chosen channels. */
export default function Notices() {
  const { data, error, reload } = useApi<{ notices: N[] }>("/api/notices");
  return (
    <Page title="Announcements" sub="Reaches students in your department, campus or university. In-app always, plus the channels you tick.">
      <div className="grid g2">
        <Card title="New announcement">
          <JsonForm submit="Send" onSubmit={async (v) => {
            const channels = ["EMAIL", "SMS", "WHATSAPP"].filter((c) => v[`ch_${c}`]);
            const r = await api<{ recipients: number }>("/api/notices", { body: { title: v.title, body: v.body, due: v.due || null, action: v.action || null, channels } });
            reload();
            alert(`Sent to ${r.recipients} students.`);
          }}>
            <label className="f">Title<input name="title" type="text" required maxLength={80} /></label>
            <label className="f">Message<textarea name="body" required maxLength={500} /></label>
            <div className="grid g2">
              <label className="f">Due date<input name="due" type="text" placeholder="YYYY-MM-DD" /></label>
              <label className="f">Button opens<select name="action"><option value="">No button</option><option value="diagnostic">Diagnostic</option><option value="mock">Mock tests</option><option value="practice">Practice</option><option value="plan">Study plan</option></select></label>
            </div>
            <div className="row">{["EMAIL", "SMS", "WHATSAPP"].map((c) => <label key={c} className="check" style={{ padding: 0 }}><input type="checkbox" name={`ch_${c}`} value="1" /><span>{c === "WHATSAPP" ? "WhatsApp" : c === "SMS" ? "SMS" : "Email"}</span></label>)}</div>
          </JsonForm>
        </Card>
        <Card title="Sent">
          {!data ? <Loading error={error} /> : data.notices.map((n) => (
            <div key={n.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <div className="row between"><b>{n.title}</b><button className="btn ghost sm" onClick={async () => { await api(`/api/notices/${n.id}`, { method: "DELETE" }); reload(); }}>Delete</button></div>
              <div className="tiny muted">{fmtDate(n.createdAt)} · {n.channels.join(", ").toLowerCase()}{n.due ? ` · due ${fmtDate(n.due)}` : ""}</div>
              <div className="small">{n.body}</div>
            </div>
          ))}
        </Card>
      </div>
    </Page>
  );
}
