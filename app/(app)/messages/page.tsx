"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/components/api";
import { Page, useApi, Loading, Pill, fmtDateTime } from "@/components/ui";

type M = { id: string; employerId: string; fromId: string; toId: string; body: string; createdAt: string; employer: { name: string; verified: boolean } };

/** Messages from employers. Only students in the talent pool receive them. */
export default function Messages() {
  const { data, error, reload } = useApi<{ messages: M[] }>("/api/me/messages");
  const me = (useSession().data?.user as { id?: string } | undefined)?.id;
  const [reply, setReply] = useState<Record<string, string>>({});
  if (!data) return <Loading error={error} />;
  const byEmp = new Map<string, M[]>();
  data.messages.forEach((m) => byEmp.set(m.employerId, [...(byEmp.get(m.employerId) ?? []), m]));
  return (
    <Page title="Messages" sub="Employers who found you in the talent pool. Your phone and email are never shared unless you share them.">
      {[...byEmp.entries()].map(([eid, ms]) => {
        const recruiter = ms.find((m) => m.toId === me)?.fromId;
        return (
          <div className="card" key={eid} style={{ marginBottom: 12 }}>
            <h2>{ms[0].employer.name} {ms[0].employer.verified && <Pill>Verified employer</Pill>}</h2>
            {ms.slice().reverse().map((m) => <div key={m.id} className={`msg ${m.fromId === me ? "u" : "a"}`} style={{ marginBottom: 8 }}>{m.body}<div className="tiny" style={{ opacity: 0.7 }}>{fmtDateTime(m.createdAt)}</div></div>)}
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input type="text" value={reply[eid] ?? ""} onChange={(e) => setReply({ ...reply, [eid]: e.target.value })} placeholder="Reply" />
              <button className="btn" disabled={!recruiter} onClick={async () => { await api("/api/me/messages", { body: { employerId: eid, toId: recruiter, body: reply[eid] } }); setReply({ ...reply, [eid]: "" }); reload(); }}>Send</button>
            </div>
          </div>
        );
      })}
      {!byEmp.size && <div className="card empty">No messages. Join the talent pool from your profile to be found by employers.</div>}
    </Page>
  );
}
