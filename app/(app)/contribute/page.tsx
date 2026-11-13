"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/components/api";
import { Page, Stat, useApi, Loading, Tabs, Pill } from "@/components/ui";
import QuestionEditor, { type QDraft } from "@/components/QuestionEditor";
import { download, upload, Table } from "@/components/ui";
import { SUBJECTS } from "@/lib/syllabus";

type Q = { id: string; type: string; subject: string; topic: string; difficulty: number; text: string; code: string | null; options: string[]; answers: number[]; explanation: string; status: string; timesSeen: number; timesRight: number; discrimination: number | null; reviews: { stage: string; decision: string | null; note: string | null }[]; _count: { reports: number } };
const STATUS: Record<string, [string, "warn" | "bad" | "grey" | undefined]> = { DRAFT: ["Sent back", "bad"], SUBMITTED: ["Submitted", "warn"], PEER_REVIEW: ["Peer review", "warn"], EXPERT_REVIEW: ["Expert review", "warn"], LIVE: ["Live", undefined], RETIRED: ["Retired", "grey"] };

export default function ContributePage() { return <Suspense fallback={<div className="spin" />}><Contribute /></Suspense>; }

/** Faculty, HODs and focal persons: write, review and improve questions. They never see live national test questions. */
function Contribute() {
  const [tab, setTab] = useState<"add" | "upload" | "dept" | "ai" | "review" | "fix" | "mine">((useSearchParams().get("tab") as "mine") ?? "add");
  const [edit, setEdit] = useState<QDraft | undefined>();
  const mine = useApi<{ questions: Q[] }>("/api/questions?view=mine", [tab]);
  const assigned = useApi<{ questions: Q[] }>(tab === "review" ? "/api/questions?view=assigned" : null, [tab]);
  const weak = useApi<{ questions: Q[] }>(tab === "fix" ? "/api/questions?view=weak" : null, [tab]);
  const deptBank = useApi<{ questions: Q[] }>(tab === "dept" ? "/api/questions?view=department" : null, [tab]);
  const scope = useApi<{ departments: { id: string; name: string; campus: { name: string } }[] }>(tab === "upload" || tab === "add" ? "/api/labtests" : null, [tab]);
  const [bank, setBank] = useState<"DEPARTMENT" | "NATIONAL">("DEPARTMENT");
  const [deptId, setDeptId] = useState("");
  const [up, setUp] = useState<{ added: number; failed: { row: number; error: string }[]; bank: string } | null>(null);
  const [upErr, setUpErr] = useState("");
  const [drafts, setDrafts] = useState<QDraft[]>([]);
  const [aiSub, setAiSub] = useState("PS");
  const [similar, setSimilar] = useState<{ id: string; text: string }[]>([]);
  const send = async (q: QDraft, source = "FACULTY") => {
    const r = await api<{ similar: { id: string; text: string }[] }>("/api/questions", { body: { ...q, source, bank, departmentId: deptId || undefined } });
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
        <Tabs value={tab} onChange={(t) => { setTab(t); setEdit(undefined); }} tabs={[["add", "Write a question"], ["upload", "Upload from Excel or CSV"], ["dept", "Department bank"], ["ai", "Draft with AI"], ["review", "Assigned to me"], ["fix", "Fix weak questions"], ["mine", "My submissions"]]} />
        {(tab === "add" || tab === "upload") && (
          <div className="grid g3" style={{ marginBottom: 12 }}>
            <label className="f">Save to<select value={bank} onChange={(e) => setBank(e.target.value as typeof bank)}>
              <option value="DEPARTMENT">Our department bank (live at once, for our own lab tests)</option>
              <option value="NATIONAL">National NSCT bank (reviewed before use)</option>
            </select></label>
            {bank === "DEPARTMENT" && (scope.data?.departments.length ?? 0) > 1 && (
              <label className="f">Department<select value={deptId} onChange={(e) => setDeptId(e.target.value)} required><option value="">Choose</option>{scope.data!.departments.map((d) => <option key={d.id} value={d.id}>{d.campus.name} · {d.name}</option>)}</select></label>
            )}
          </div>
        )}
        {tab === "upload" && (
          <div>
            <ol className="small" style={{ marginTop: 0 }}>
              <li>Download the template. It has two example rows and a sheet that explains every column.</li>
              <li>Fill one question per row. Up to 1,000 rows per file, in Excel (.xlsx) or CSV.</li>
              <li>Upload it. Each row is checked on its own, and you get a list of rows that need fixing.</li>
            </ol>
            <div className="row" style={{ marginBottom: 12 }}>
              <button className="btn sec" type="button" onClick={() => download("/api/questions/template", "nsct-question-template.xlsx").catch((e) => setUpErr(e.message))}>Download template</button>
            </div>
            <form className="row" onSubmit={async (e) => {
              e.preventDefault(); setUpErr(""); setUp(null);
              const fd = new FormData(e.currentTarget); fd.set("bank", bank); if (deptId) fd.set("departmentId", deptId);
              try { setUp(await upload("/api/questions/import", fd)); } catch (er) { setUpErr((er as Error).message); }
            }}>
              <input type="file" name="file" accept=".xlsx,.csv" required />
              <button className="btn" type="submit">Upload questions</button>
            </form>
            {upErr && <div className="notice bad" style={{ marginTop: 12 }}>{upErr}</div>}
            {up && (
              <div className={`notice ${up.failed.length ? "" : "info"}`} style={{ marginTop: 12 }}>
                Added {up.added} questions {up.bank === "DEPARTMENT" ? "to your department bank. They are ready for your lab tests." : "for review in the national bank."}
                {up.failed.length > 0 && <Table rows={up.failed} cols={[["Row", (f) => f.row], ["Problem", (f) => <span className="small">{f.error}</span>]]} />}
              </div>
            )}
          </div>
        )}
        {tab === "dept" && (!deptBank.data ? <Loading error={deptBank.error} /> : (
          <>
            <p className="small muted" style={{ marginTop: 0 }}>{deptBank.data.questions.length} questions in your department bank. Use them in Lab tests. They never appear in national mocks.</p>
            <div className="qlist">{deptBank.data.questions.map((q) => (
              <div className="q" key={q.id}>
                <div className="qmeta"><Pill tone="grey">{q.subject}</Pill><Pill tone="grey">{q.topic}</Pill><Pill tone="grey">{q.type}</Pill><Pill tone="grey">difficulty {q.difficulty}</Pill>{q.timesSeen > 0 && <Pill tone="grey">{Math.round((100 * q.timesRight) / q.timesSeen)}% correct of {q.timesSeen}</Pill>}</div>
                <b>{q.text}</b>{q.code && <pre className="code">{q.code}</pre>}
                <ol type="A" className="small">{q.options.map((o, j) => <li key={j} style={q.answers.includes(j) ? { color: "var(--good)", fontWeight: 700 } : {}}>{o}</li>)}</ol>
                <div className="row"><button className="btn ghost sm" onClick={async () => { if (window.confirm("Retire this question from your department bank?")) { await api(`/api/questions/${q.id}`, { method: "PATCH", body: { action: "retire" } }).catch((e) => alert(e.message)); deptBank.reload(); } }}>Retire</button></div>
              </div>
            ))}{!deptBank.data.questions.length && <div className="empty">Empty. Upload questions or write one.</div>}</div>
          </>
        ))}
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
