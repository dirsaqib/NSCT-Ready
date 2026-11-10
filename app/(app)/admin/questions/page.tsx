"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, SUBJECT_SHORT } from "@/components/api";
import { SUBJECTS } from "@/lib/syllabus";
import { Page, Card, Stat, useApi, Loading, Table, Tabs, Pill, upload, fmtDateTime } from "@/components/ui";
import QuestionEditor, { type QDraft } from "@/components/QuestionEditor";

type Q = { id: string; type: string; subject: string; topic: string; difficulty: number; skillLevel: string | null; text: string; code: string | null; options: string[]; answers: number[]; explanation: string; status: string; source: string; secure: boolean; version: number; timesSeen: number; timesRight: number; discrimination: number | null; replacesId: string | null; author: { email: string | null } | null; reviews: { stage: string; decision: string | null; note: string | null; reviewer?: { email: string | null } }[]; _count: { reports: number } };
type A = { id: string; type: string; subject: string; topic: string; text: string; labelledDifficulty: number; seen: number; pCorrect: number | null; discrimination: number | null; reports: number; secure: boolean; flags: string[] };
type V = { id: string; version: number; createdAt: string; snapshot: { text: string; options: string[]; answers: number[] } };
type Staff = { id: string; email: string | null; role: string; university: { name: string } | null };

export default function QuestionsPage() { return <Suspense fallback={<div className="spin" />}><Questions /></Suspense>; }

/** Super admin: review workflow, reviewer assignment, secure pool, versions, item analysis and import. */
function Questions() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<"queue" | "live" | "analysis" | "add" | "import">("queue");
  const [subject, setSubject] = useState("");
  const status = tab === "queue" ? "" : "LIVE";
  const list = useApi<{ questions: Q[]; counts: { status: string; _count: number }[] }>(tab === "queue" || tab === "live" ? `/api/questions?view=all&subject=${subject}${status ? `&status=${status}` : ""}` : null, [tab, subject]);
  const analysis = useApi<{ rows: A[] }>(tab === "analysis" ? "/api/admin/questions-analysis" : null, [tab]);
  const staff = useApi<{ users: Staff[] }>("/api/admin/users?staff=1");
  const [versions, setVersions] = useState<{ id: string; rows: V[] } | null>(null);
  const [msg, setMsg] = useState("");
  const focus = sp.get("id");
  const act = async (id: string, body: object) => { await api(`/api/questions/${id}`, { method: "PATCH", body }).catch((e) => alert(e.message)); list.reload(); analysis.reload(); };
  const counts = Object.fromEntries((list.data?.counts ?? []).map((c) => [c.status, c._count]));
  const rows = (list.data?.questions ?? []).filter((q) => (tab === "queue" ? !["LIVE", "RETIRED"].includes(q.status) : true)).sort((a, b) => (a.id === focus ? -1 : b.id === focus ? 1 : 0));
  return (
    <Page title="Question bank" sub="Submitted, peer review, expert review, then live. Only you can make a question live.">
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat k="Waiting" v={(counts.SUBMITTED ?? 0) + (counts.DRAFT ?? 0)} /><Stat k="In peer review" v={counts.PEER_REVIEW ?? 0} />
        <Stat k="Expert review" v={counts.EXPERT_REVIEW ?? 0} /><Stat k="Live" v={counts.LIVE ?? 0} />
      </div>
      {msg && <div className="notice info" style={{ marginBottom: 12 }}>{msg}</div>}
      <div className="card">
        <Tabs value={tab} onChange={setTab} tabs={[["queue", "Review queue"], ["live", "Live bank"], ["analysis", "Item analysis"], ["add", "Add question"], ["import", "Import from Excel"]]} />
        {(tab === "queue" || tab === "live") && (
          <>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: "auto", marginBottom: 12 }}><option value="">All subjects</option>{SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</select>
            {!list.data ? <Loading error={list.error} /> : (
              <div className="qlist">{rows.map((q) => (
                <div className="q" key={q.id} style={q.id === focus ? { borderColor: "var(--brand)" } : {}}>
                  <div className="qmeta">
                    <Pill tone={q.status === "LIVE" ? undefined : "warn"}>{q.status.toLowerCase().replace("_", " ")}</Pill><Pill tone="grey">{q.type}</Pill><Pill tone="grey">{SUBJECT_SHORT[q.subject]} · {q.topic}</Pill><Pill tone="grey">difficulty {q.difficulty}</Pill>
                    {q.skillLevel && <Pill tone="grey">{q.skillLevel}</Pill>}{q.secure && <Pill tone="bad">secure pool</Pill>}{q.replacesId && <Pill tone="warn">suggested fix</Pill>}
                    <span className="tiny muted">v{q.version} · {q.source.toLowerCase()} · {q.author?.email ?? "platform"}</span>
                  </div>
                  <b>{q.text}</b>{q.code && <pre className="code">{q.code}</pre>}
                  <ol type="A" className="small">{q.options.map((o, j) => <li key={j} style={q.answers.includes(j) ? { color: "var(--good)", fontWeight: 700 } : {}}>{o}</li>)}</ol>
                  <div className="small muted">{q.explanation}</div>
                  {q.reviews.length > 0 && <div className="small">{q.reviews.map((r, i) => <div key={i}>{r.stage.toLowerCase()}: {r.reviewer?.email ?? ""} {r.decision ? <b>{r.decision.toLowerCase()}</b> : "waiting"} {r.note && `· ${r.note}`}</div>)}</div>}
                  {q.timesSeen > 0 && <div className="tiny muted">{Math.round((100 * q.timesRight) / q.timesSeen)}% correct of {q.timesSeen} · discrimination {q.discrimination ?? "n/a"} · {q._count.reports} reports</div>}
                  <div className="row" style={{ marginTop: 8 }}>
                    {q.status !== "LIVE" && <>
                      <select defaultValue="" onChange={(e) => e.target.value && act(q.id, { action: "assign", reviewerIds: [e.target.value] })} style={{ width: "auto" }}><option value="">Assign peer reviewer</option>{staff.data?.users.map((s) => <option key={s.id} value={s.id}>{s.email} ({s.university?.name ?? s.role.toLowerCase()})</option>)}</select>
                      <button className="btn sm sec" onClick={() => act(q.id, { action: "expert" })}>Send to expert review</button>
                      <button className="btn sm" onClick={() => act(q.id, { action: "approve" })}>Approve and make live</button>
                      <button className="btn sm sec" onClick={() => { const note = window.prompt("What should the author change?"); if (note) act(q.id, { action: "reject", note }); }}>Send back</button>
                    </>}
                    {q.status === "LIVE" && <button className="btn sm sec" onClick={() => act(q.id, { action: "retire" })}>Retire</button>}
                    <button className="btn sm ghost" onClick={() => act(q.id, { action: "secure", secure: !q.secure })}>{q.secure ? "Release from secure pool" : "Move to secure pool"}</button>
                    <button className="btn sm ghost" onClick={async () => setVersions({ id: q.id, rows: (await api<{ versions: V[] }>(`/api/questions/${q.id}/versions`)).versions })}>History</button>
                  </div>
                  {versions?.id === q.id && <div className="small" style={{ marginTop: 8 }}>{versions.rows.length ? versions.rows.map((v) => <div key={v.id}>v{v.version} · {fmtDateTime(v.createdAt)}: {v.snapshot.text.slice(0, 100)} (answer {(v.snapshot.answers ?? []).map((a) => "ABCDEF"[a]).join(", ")})</div>) : "No earlier versions."}</div>}
                </div>
              ))}{!rows.length && <div className="empty">Nothing here.</div>}</div>
            )}
          </>
        )}
        {tab === "analysis" && (!analysis.data ? <Loading error={analysis.error} /> : (
          <Table rows={analysis.data.rows} cols={[
            ["Question", (r) => <><span className="tiny muted">{SUBJECT_SHORT[r.subject]} · {r.topic}</span><div className="small">{r.text}</div></>],
            ["Seen", (r) => r.seen], ["Correct", (r) => (r.pCorrect == null ? "n/a" : `${r.pCorrect}%`)], ["Labelled", (r) => r.labelledDifficulty], ["Discrimination", (r) => r.discrimination ?? "n/a"],
            ["Flags", (r) => <div className="row">{r.flags.map((f) => <Pill key={f} tone="bad">{f}</Pill>)}</div>],
            ["", (r) => <button className="btn ghost sm" onClick={() => act(r.id, { action: "retire" })}>Retire</button>],
          ]} />
        ))}
        {tab === "add" && <QuestionEditor showSecure submitLabel="Add (goes to review queue)" onSubmit={async (q: QDraft) => { const r = await api<{ question: { id: string }; similar: { text: string }[] }>("/api/questions", { body: { ...q, source: "ADMIN" } }); setMsg(r.similar?.length ? `Saved. Similar questions exist: ${r.similar.map((s) => s.text.slice(0, 60)).join(" | ")}` : "Saved to the review queue."); }} />}
        {tab === "import" && (
          <Card>
            <p className="small">Columns: subject (PS, PROG, DSA, DB, SE, WEB, AI, NET, OS, SEC), topic, difficulty (1 to 3), type (SINGLE or MULTI), text, option_a to option_f, answer (letters, e.g. B or A,C), explanation, skill_level. Rows go to the review queue. Duplicates are skipped.</p>
            <form className="row" onSubmit={async (e) => { e.preventDefault(); try { const r = await upload<{ added: number; failed: { row: number; error: string }[] }>("/api/questions/import", new FormData(e.currentTarget)); setMsg(`Added ${r.added}. ${r.failed.length ? `Skipped: ${r.failed.map((f) => `row ${f.row} (${f.error})`).join("; ")}` : ""}`); } catch (er) { setMsg((er as Error).message); } }}>
              <input type="file" name="file" accept=".xlsx" required /><button className="btn" type="submit">Import</button>
            </form>
          </Card>
        )}
      </div>
    </Page>
  );
}
