"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/components/api";
import { Page, Stat, useApi, Loading, Tabs, Pill } from "@/components/ui";
import QuestionEditor, { type QDraft } from "@/components/QuestionEditor";
import { SUBJECTS } from "@/lib/syllabus";

type Q = { id: string; type: string; subject: string; topic: string; difficulty: number; text: string; code: string | null; options: string[]; answers: number[]; explanation: string; status: string; timesSeen: number; timesRight: number; discrimination: number | null; reviews: { stage: string; decision: string | null; note: string | null }[]; _count: { reports: number } };
const STATUS: Record<string, [string, "warn" | "bad" | "grey" | undefined]> = { DRAFT: ["Sent back", "bad"], SUBMITTED: ["Submitted", "warn"], PEER_REVIEW: ["Peer review", "warn"], EXPERT_REVIEW: ["Expert review", "warn"], LIVE: ["Live", undefined], RETIRED: ["Retired", "grey"] };

export default function ContributePage() { return <Suspense fallback={<div className="spin" />}><Contribute /></Suspense>; }

/** Faculty, HODs and focal persons: write, review and improve questions. They never see live national test questions. */
function Contribute() {
  const [tab, setTab] = useState<"add" | "ai" | "review" | "fix" | "mine">((useSearchParams().get("tab") as "mine") ?? "add");
  const [edit, setEdit] = useState<QDraft | undefined>();
  const mine = useApi<{ questions: Q[] }>("/api/questions?view=mine", [tab]);
  const assigned = useApi<{ questions: Q[] }>(tab === "review" ? "/api/questions?view=assigned" : null, [tab]);
  const weak = useApi<{ questions: Q[] }>(tab === "fix" ? "/api/questions?view=weak" : null, [tab]);
  const [drafts, setDrafts] = useState<QDraft[]>([]);
  const [aiSub, setAiSub] = useState("PS");
  const [similar, setSimilar] = useState<{ id: string; text: string }[]>([]);
  const send = async (q: QDraft, source = "FACULTY") => {
    const r = await api<{ similar: { id: string; text: string }[] }>("/api/questions", { body: { ...q, source } });
    setSimilar(r.similar ?? []);
  };
  const m = mine.data?.questions ?? [];
  return (
    <Page title="Improve the question bank" sub="Submissions go through peer review and final approval before students see them.">
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat k="My submissions" v={m.length} /><Stat k="Live" v={m.filter((q) => q.status === "LIVE").length} />
        <Stat k="In review" v={m.filter((q) => ["SUBMITTED", "PEER_REVIEW", "EXPERT_REVIEW"].includes(q.status)).length} />
        <Stat k="Answered by students" v={m.reduce((s, q) => s + q.timesSeen, 0)} />
      </div>
      {similar.length > 0 && <div className="notice" style={{ marginBottom: 12 }}>Saved. Similar questions already exist, please check yours is different: {similar.map((s) => s.text.slice(0, 60)).join(" | ")}</div>}
      <div className="card">
        <Tabs value={tab} onChange={(t) => { setTab(t); setEdit(undefined); }} tabs={[["add", "Write a question"], ["ai", "Draft with AI"], ["review", "Assigned to me"], ["fix", "Fix weak questions"], ["mine", "My submissions"]]} />
        {tab === "add" && <QuestionEditor key={edit?.replacesId ?? "new"} initial={edit} submitLabel="Submit for review" onSubmit={(q) => send(q)} />}
        {tab === "ai" && (
          <>
            <form className="row" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const r = await api<{ drafts: { q: string; code: string; options: string[]; answer: number; explanation: string; topic: string; difficulty?: number }[] }>("/api/ai/generate", { body: { subject: aiSub, topic: f.get("topic") || undefined, count: 5 } }); setDrafts(r.drafts.map((x) => ({ type: "SINGLE", subject: aiSub, topic: x.topic, difficulty: x.difficulty ?? 2, text: x.q, code: x.code, options: x.options, answers: [x.answer], explanation: x.explanation }))); }}>
              <select value={aiSub} onChange={(e) => setAiSub(e.target.value)} style={{ width: "auto" }}>{SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</select>
              <input type="text" name="topic" placeholder="Topic (optional)" style={{ maxWidth: 240 }} /><button className="btn" type="submit">Generate 5 drafts</button>
            </form>
            <div className="qlist">{drafts.map((x, i) => (
              <div className="q" key={i}><b>{x.text}</b>{x.code && <pre className="code">{x.code}</pre>}
                <ol type="A" className="small">{x.options.map((o, j) => <li key={j} style={x.answers.includes(j) ? { color: "var(--good)", fontWeight: 700 } : {}}>{o}</li>)}</ol>
                <div className="row"><button className="btn sm" onClick={async () => { await send(x, "AI_REVIEWED"); setDrafts(drafts.filter((_, k) => k !== i)); }}>Submit for review</button><button className="btn sm sec" onClick={() => { setEdit(x); setTab("add"); }}>Edit first</button></div>
              </div>
            ))}</div>
          </>
        )}
        {tab === "review" && (!assigned.data ? <Loading error={assigned.error} /> : (
          <div className="qlist">{assigned.data.questions.map((q) => (
            <div className="q" key={q.id}>
              <div className="qmeta"><Pill tone="grey">{q.type}</Pill><Pill tone="grey">{q.topic}</Pill></div>
              <b>{q.text}</b>{q.code && <pre className="code">{q.code}</pre>}
              <ol type="A" className="small">{q.options.map((o, j) => <li key={j} style={q.answers.includes(j) ? { color: "var(--good)", fontWeight: 700 } : {}}>{o}</li>)}</ol>
              <div className="small muted">{q.explanation}</div>
              <form className="row" style={{ marginTop: 8 }} onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await api(`/api/questions/${q.id}/review`, { body: { decision: (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value"), note: f.get("note") || undefined } }); assigned.reload(); }}>
                <input name="note" type="text" placeholder="Note for the author (optional)" />
                <button className="btn sm" type="submit" value="APPROVE">Approve</button><button className="btn sm sec" type="submit" value="REJECT">Needs changes</button>
              </form>
            </div>
          ))}{!assigned.data.questions.length && <div className="empty">Nothing assigned to you.</div>}</div>
        ))}
        {tab === "fix" && (!weak.data ? <Loading error={weak.error} /> : (
          <div className="qlist">{weak.data.questions.map((q) => (
            <div className="q" key={q.id}>
              <div className="qmeta"><Pill tone="grey">{q.topic}</Pill>{q.timesSeen > 0 && <Pill tone="warn">{Math.round((100 * q.timesRight) / q.timesSeen)}% correct of {q.timesSeen}</Pill>}{q._count.reports > 0 && <Pill tone="bad">{q._count.reports} reports</Pill>}{q.discrimination != null && <Pill tone="grey">discrimination {q.discrimination}</Pill>}</div>
              <b>{q.text}</b>
              <div style={{ marginTop: 8 }}><button className="btn sm" onClick={() => { setEdit({ type: q.type as QDraft["type"], subject: q.subject, topic: q.topic, difficulty: q.difficulty, text: q.text, code: q.code ?? "", options: q.options, answers: q.answers, explanation: q.explanation, replacesId: q.id }); setTab("add"); }}>Suggest a fix</button></div>
            </div>
          ))}{!weak.data.questions.length && <div className="empty">No weak questions right now.</div>}</div>
        ))}
        {tab === "mine" && (
          <div className="qlist">{m.map((q) => (
            <div className="q" key={q.id}>
              <div className="qmeta"><Pill tone={STATUS[q.status]?.[1]}>{STATUS[q.status]?.[0]}</Pill><Pill tone="grey">{q.type}</Pill><Pill tone="grey">{q.topic}</Pill>{q.timesSeen > 0 && <Pill tone="grey">{Math.round((100 * q.timesRight) / q.timesSeen)}% correct of {q.timesSeen}</Pill>}{q.discrimination != null && <Pill tone="grey">discrimination {q.discrimination}</Pill>}</div>
              <b>{q.text}</b>
              {q.reviews.filter((r) => r.note).map((r, i) => <div key={i} className="small">Reviewer ({r.stage.toLowerCase()}): {r.note}</div>)}
            </div>
          ))}{!m.length && <div className="empty">No submissions yet.</div>}</div>
        )}
      </div>
    </Page>
  );
}
