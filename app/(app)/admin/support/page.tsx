"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/components/api";
import { Page, Card, useApi, Loading, Table, Tabs, Pill, fmtDateTime } from "@/components/ui";

type T = { id: string; category: string; subject: string; status: string; updatedAt: string; user: { email: string | null; phone: string | null; role: string; profile: { fullName: string } | null }; _count: { messages: number } };
type Q = { id: string; text: string; options: string[]; answers: number[]; explanation?: string };
type R = { id: string; attemptId: string; reason: string; createdAt: string; user: { profile: { fullName: string } | null }; attempt: { type: string }; item?: { chosen: number[]; question: Q } };
type Rep = { id: string; reason: string; createdAt: string; question: Q };
const L = "ABCDEF";

/** Support tickets, score re-check requests and wrong-question reports. */
export default function Support() {
  const [tab, setTab] = useState<"tickets" | "rechecks" | "reports">("tickets");
  const [status, setStatus] = useState("OPEN");
  const t = useApi<{ tickets: T[] }>(tab === "tickets" ? `/api/tickets?status=${status}` : null, [tab, status]);
  const r = useApi<{ rechecks: R[]; reports: Rep[] }>(tab !== "tickets" ? "/api/admin/rechecks" : null, [tab]);
  const answer = async (body: object) => { await api("/api/admin/rechecks", { body }).catch((e) => alert(e.message)); r.reload(); };
  const Opts = ({ q, chosen }: { q: Q; chosen?: number[] }) => <ol type="A" className="small">{q.options.map((o, j) => <li key={j} style={q.answers.includes(j) ? { color: "var(--good)", fontWeight: 700 } : chosen?.includes(j) ? { color: "var(--bad)" } : {}}>{o}{chosen?.includes(j) ? "  (student)" : ""}</li>)}</ol>;
  return (
    <Page title="Support and re-checks" sub="Answer within 2 working days. Every reply notifies the person by email.">
      <div className="card">
        <Tabs value={tab} onChange={setTab} tabs={[["tickets", "Tickets"], ["rechecks", "Score re-checks"], ["reports", "Wrong-question reports"]]} />
        {tab === "tickets" && (
          <>
            <Tabs value={status} onChange={setStatus} tabs={[["OPEN", "Open"], ["ANSWERED", "Answered"], ["CLOSED", "Closed"]]} />
            {!t.data ? <Loading error={t.error} /> : <Table rows={t.data.tickets} empty="No tickets." cols={[["Subject", (x) => <Link href={`/support/${x.id}`}><b>{x.subject}</b></Link>], ["From", (x) => <>{x.user.profile?.fullName ?? x.user.email ?? x.user.phone}<div className="tiny muted">{x.user.role.toLowerCase()}</div></>], ["Category", (x) => <Pill tone="grey">{x.category}</Pill>], ["Messages", (x) => x._count.messages], ["Updated", (x) => fmtDateTime(x.updatedAt)]]} />}
          </>
        )}
        {tab === "rechecks" && (!r.data ? <Loading error={r.error} /> : (
          <div className="qlist">{r.data.rechecks.map((x) => (
            <div className="q" key={x.id}>
              <div className="qmeta"><Pill tone="grey">{x.attempt.type.toLowerCase()}</Pill><span className="tiny muted">{x.user.profile?.fullName} · {fmtDateTime(x.createdAt)}</span></div>
              <div className="small"><b>Student says:</b> {x.reason}</div>
              {x.item && <><b>{x.item.question.text}</b><Opts q={x.item.question} chosen={x.item.chosen} /><div className="small muted">{x.item.question.explanation}</div></>}
              <form className="grid" style={{ gap: 8, marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); answer({ kind: "recheck", id: x.id, status: (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value"), response: String(f.get("response")), creditAll: f.get("all") === "1" }); }}>
                <input name="response" type="text" required minLength={3} placeholder="Reply to the student" />
                <label className="check" style={{ padding: 0 }}><input type="checkbox" name="all" value="1" /><span>If upheld, give every student credit for this question and retire it</span></label>
                <div className="row"><button className="btn sm" type="submit" value="UPHELD">Uphold</button><button className="btn sm sec" type="submit" value="REJECTED">Reject</button></div>
              </form>
            </div>
          ))}{!r.data.rechecks.length && <div className="empty">No open re-checks.</div>}</div>
        ))}
        {tab === "reports" && (!r.data ? <Loading error={r.error} /> : (
          <div className="qlist">{r.data.reports.map((x) => (
            <div className="q" key={x.id}>
              <div className="small"><b>Report:</b> {x.reason} <span className="tiny muted">{fmtDateTime(x.createdAt)}</span></div>
              <b>{x.question.text}</b><Opts q={x.question} />
              <div className="row"><Link className="btn sm sec" href={`/admin/questions?id=${x.question.id}`}>Open question</Link><button className="btn sm" onClick={() => answer({ kind: "report", id: x.id })}>Mark resolved</button></div>
            </div>
          ))}{!r.data.reports.length && <div className="empty">No open reports.</div>}</div>
        ))}
      </div>
    </Page>
  );
}
