"use client";
import Link from "next/link";
import { useState } from "react";
import { api, SUBJECT_SHORT } from "@/components/api";
import { Page, useApi, Loading, Pill, fmtDate } from "@/components/ui";
import { SUBJECTS } from "@/lib/syllabus";

type T = { id: string; subject: string; topic: string | null; title: string; resolved: boolean; createdAt: string; replies: number; answered: boolean; by: string };

/** Students ask doubts. Instructors answer. Unanswered filter helps faculty find work. */
export default function Discuss() {
  const [sub, setSub] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const { data, error, reload } = useApi<{ threads: T[] }>(`/api/threads?subject=${sub}${onlyOpen ? "&unanswered=1" : ""}`, [sub, onlyOpen]);
  const [show, setShow] = useState(false);
  return (
    <Page title="Doubts and discussion" sub="Ask anything from the syllabus. Answers from instructors are marked." actions={<button className="btn" onClick={() => setShow(!show)}>Ask a question</button>}>
      {show && (
        <form className="card grid" style={{ gap: 10, marginBottom: 16 }} onSubmit={async (e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget);
          await api("/api/threads", { body: { subject: f.get("s"), topic: f.get("t") || undefined, title: f.get("title"), body: f.get("body") } });
          setShow(false); reload();
        }}>
          <div className="grid g2"><select name="s">{SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</select><input name="t" type="text" placeholder="Topic (optional)" /></div>
          <input name="title" type="text" required minLength={5} placeholder="Your question in one line" />
          <textarea name="body" required minLength={5} placeholder="Explain what you tried and where you are stuck" />
          <div><button className="btn" type="submit">Post</button></div>
        </form>
      )}
      <div className="row" style={{ marginBottom: 12 }}>
        <select value={sub} onChange={(e) => setSub(e.target.value)} style={{ width: "auto" }}><option value="">All domains</option>{SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</select>
        <label className="check" style={{ padding: 0 }}><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /><span>Waiting for an instructor</span></label>
      </div>
      {!data ? <Loading error={error} /> : (
        <div className="card qlist">
          {data.threads.map((t) => (
            <div className="q" key={t.id}>
              <Link href={`/discuss/${t.id}`}><b>{t.title}</b></Link>
              <div className="row tiny muted" style={{ marginTop: 4 }}><Pill tone="grey">{SUBJECT_SHORT[t.subject]}</Pill>{t.answered ? <Pill>Instructor answered</Pill> : <Pill tone="warn">Waiting</Pill>}{t.resolved && <Pill>Resolved</Pill>}<span>{t.replies} replies · {t.by} · {fmtDate(t.createdAt)}</span></div>
            </div>
          ))}
          {!data.threads.length && <div className="empty">No questions yet.</div>}
        </div>
      )}
    </Page>
  );
}
