"use client";
import { useState } from "react";
import { api, SUBJECT_SHORT } from "@/components/api";
import { SUBJECTS } from "@/lib/syllabus";
import { Page, Card, useApi, Loading, Table, Tabs, Pill, JsonForm, fmtDate } from "@/components/ui";

type C = { id: string; name: string; university: string; program: string; semester: string; city: string | null; readiness: number; bestMock: number; skills: Record<string, number>; certificates: { code: string; score: number; issuedAt: string }[] };
type SL = { id: string; candidateId: string; stage: string; note: string | null; candidate: { profile: { fullName: string; program: string; university: { name: string } } | null } };
type M = { id: string; body: string; fromId: string; createdAt: string };
type As = { id: string; title: string; inviteCode: string; durationMin: number; counts: Record<string, number>; results: { score: number; submittedAt: string; flags: string[]; user: { id: string; profile: { fullName: string; program: string; university: { name: string } } | null } }[] };
const STAGES = ["SHORTLISTED", "CONTACTED", "INTERVIEW", "HIRED", "CLOSED"];

/** Employers: search the opt-in talent pool, shortlist, message, run hiring tests and verify certificates. */
export default function Employer() {
  const [tab, setTab] = useState<"search" | "shortlist" | "tests" | "verify">("search");
  const [f, setF] = useState<Record<string, string>>({ minSkill: "60" });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const cands = useApi<{ candidates: C[] }>(tab === "search" ? `/api/employer/candidates?${qs}` : null, [tab, qs]);
  const sl = useApi<{ shortlist: SL[] }>("/api/employer/shortlist", [tab]);
  const tests = useApi<{ assessments: As[] }>(tab === "tests" ? "/api/employer/assessments" : null, [tab]);
  const [chat, setChat] = useState<{ id: string; name: string; rows: M[] } | null>(null);
  const [cert, setCert] = useState<Record<string, unknown> | null>(null);
  const shortlist = async (candidateId: string, stage?: string, note?: string) => { await api("/api/employer/shortlist", { body: { candidateId, stage, note } }); sl.reload(); };
  const openChat = async (id: string, name: string) => setChat({ id, name, rows: (await api<{ messages: M[] }>(`/api/employer/messages?candidateId=${id}`)).messages });
  const listed = new Set(sl.data?.shortlist.map((s) => s.candidateId));
  return (
    <Page title="Find verified talent" sub="Only students who opted in appear. Contact details stay private: message through the platform.">
      <div className="card">
        <Tabs value={tab} onChange={setTab} tabs={[["search", "Search candidates"], ["shortlist", `Shortlist (${sl.data?.shortlist.length ?? 0})`], ["tests", "Hiring tests"], ["verify", "Verify a certificate"]]} />
        {tab === "search" && (
          <>
            <div className="grid g4" style={{ marginBottom: 12 }}>
              <label className="f">Strong in<select value={f.skill ?? ""} onChange={(e) => setF({ ...f, skill: e.target.value })}><option value="">Any subject</option>{SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</select></label>
              <label className="f">Min subject accuracy %<input type="number" min={0} max={100} value={f.minSkill} onChange={(e) => setF({ ...f, minSkill: e.target.value })} /></label>
              <label className="f">Min best mock %<input type="number" min={0} max={100} value={f.minScore ?? ""} onChange={(e) => setF({ ...f, minScore: e.target.value })} /></label>
              <label className="f">City<input type="text" value={f.city ?? ""} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>
            </div>
            {!cands.data ? <Loading error={cands.error} /> : (
              <Table rows={cands.data.candidates} empty="No candidates match." cols={[
                ["Candidate", (c) => <><b>{c.name}</b><div className="tiny muted">{c.university} · {c.program} · semester {c.semester}{c.city ? ` · ${c.city}` : ""}</div></>],
                ["Readiness", (c) => <b>{c.readiness}</b>], ["Best mock", (c) => `${c.bestMock}%`],
                ["Strengths", (c) => <div className="row">{Object.entries(c.skills).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => <Pill key={k} tone="grey">{SUBJECT_SHORT[k]} {v}%</Pill>)}</div>],
                ["Certificate", (c) => c.certificates[0] ? <code className="tiny">{c.certificates[0].code}</code> : ""],
                ["", (c) => <div className="row">{listed.has(c.id) ? <Pill>shortlisted</Pill> : <button className="btn sm" onClick={() => shortlist(c.id)}>Shortlist</button>}<button className="btn sm sec" onClick={() => openChat(c.id, c.name)}>Message</button></div>],
              ]} />
            )}
          </>
        )}
        {tab === "shortlist" && (!sl.data ? <Loading error={sl.error} /> : (
          <Table rows={sl.data.shortlist} empty="Nobody shortlisted yet." cols={[
            ["Candidate", (s) => <><b>{s.candidate.profile?.fullName}</b><div className="tiny muted">{s.candidate.profile?.university.name} · {s.candidate.profile?.program}</div></>],
            ["Stage", (s) => <select value={s.stage} onChange={(e) => shortlist(s.candidateId, e.target.value)} style={{ width: "auto" }}>{STAGES.map((x) => <option key={x} value={x}>{x.toLowerCase()}</option>)}</select>],
            ["Note", (s) => <input type="text" defaultValue={s.note ?? ""} onBlur={(e) => e.target.value !== (s.note ?? "") && shortlist(s.candidateId, undefined, e.target.value)} />],
            ["", (s) => <div className="row"><button className="btn sm sec" onClick={() => openChat(s.candidateId, s.candidate.profile?.fullName ?? "")}>Message</button><button className="btn sm ghost" onClick={async () => { await api("/api/employer/shortlist", { method: "DELETE", body: { candidateId: s.candidateId } }); sl.reload(); }}>Remove</button></div>],
          ]} />
        ))}
        {tab === "tests" && (
          <div className="grid g2">
            <div>{!tests.data ? <Loading error={tests.error} /> : tests.data.assessments.map((a) => (
              <div className="q" key={a.id}>
                <div className="row between"><b>{a.title}</b><span className="small">Invite code <code>{a.inviteCode}</code></span></div>
                <div className="tiny muted">{Object.values(a.counts).reduce((s, x) => s + x, 0)} questions · {a.durationMin} minutes · candidates enter the code under Mock tests</div>
                <Table rows={a.results} empty="No results yet." cols={[["Candidate", (r) => <>{r.user.profile?.fullName}<div className="tiny muted">{r.user.profile?.university.name}</div></>], ["Score", (r) => <b>{r.score}%</b>], ["Date", (r) => fmtDate(r.submittedAt)], ["Integrity", (r) => (r.flags.length ? <Pill tone="bad">{r.flags.length} flags</Pill> : "Clean")]]} />
              </div>
            ))}</div>
            <JsonForm submit="Create test" onSubmit={async (v) => { await api("/api/employer/assessments", { body: { title: v.title, durationMin: Number(v.durationMin), counts: Object.fromEntries(SUBJECTS.map((s) => [s.key, Number(v[s.key] || 0)])) } }); tests.reload(); }}>
              <label className="f">Title<input name="title" type="text" required placeholder="Junior developer screening" /></label>
              <label className="f">Minutes<input name="durationMin" type="number" min={10} max={180} defaultValue={45} /></label>
              <div className="grid g5">{SUBJECTS.map((s) => <label key={s.key} className="f">{s.short}<input name={s.key} type="number" min={0} max={40} defaultValue={0} /></label>)}</div>
            </JsonForm>
          </div>
        )}
        {tab === "verify" && (
          <Card>
            <form className="row" onSubmit={async (e) => { e.preventDefault(); const code = String(new FormData(e.currentTarget).get("code")).trim().toUpperCase(); setCert(await api(`/api/verify/${encodeURIComponent(code)}`).catch((er) => ({ error: (er as Error).message }))); }}>
              <input name="code" type="text" required placeholder="NR-XXXX-XXXX" style={{ maxWidth: 240 }} /><button className="btn" type="submit">Verify</button>
            </form>
            {cert && <pre className="code" style={{ marginTop: 12 }}>{JSON.stringify(cert, null, 2)}</pre>}
            <p className="small muted">For bulk checks, ask the platform team for an API key and call /api/certificates/verify.</p>
          </Card>
        )}
      </div>
      {chat && (
        <Card title={`Messages with ${chat.name}`} style={{ marginTop: 16 }} right={<button className="btn ghost sm" onClick={() => setChat(null)}>Close</button>}>
          {chat.rows.map((m) => <div key={m.id} className="small" style={{ textAlign: m.fromId !== chat.id ? "right" : "left", margin: "6px 0" }}><span className="pill grey">{m.body}</span></div>)}
          <form className="row" onSubmit={async (e) => { e.preventDefault(); const el = e.currentTarget; await api("/api/employer/messages", { body: { candidateId: chat.id, body: String(new FormData(el).get("body")) } }); el.reset(); openChat(chat.id, chat.name); }}>
            <input name="body" type="text" required minLength={5} placeholder="Write a message. The candidate gets an email and can reply in the app." /><button className="btn" type="submit">Send</button>
          </form>
        </Card>
      )}
    </Page>
  );
}
