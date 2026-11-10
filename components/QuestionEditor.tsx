"use client";
import { useState } from "react";
import { SUBJECTS } from "@/lib/syllabus";

export type QDraft = {
  type: "SINGLE" | "MULTI" | "SCENARIO" | "CODE"; subject: string; topic: string; difficulty: number; skillLevel?: string;
  text: string; code?: string; options: string[]; answers: number[]; explanation: string;
  scenario?: { title: string; passage: string }; language?: string; starterCode?: string; tests?: { input: string; expected: string; hidden: boolean }[];
  replacesId?: string; secure?: boolean;
};

export const blankDraft = (subject = "PS"): QDraft => ({ type: "SINGLE", subject, topic: "", difficulty: 2, text: "", code: "", options: ["", "", "", ""], answers: [0], explanation: "" });
const L = "ABCDEF";
const SKILLS = ["Remember", "Understand", "Apply", "Analyse", "Evaluate", "Create"];

/** One editor for all four question types. */
export default function QuestionEditor({ initial, onSubmit, submitLabel, showSecure }: { initial?: QDraft; onSubmit: (q: QDraft) => Promise<void>; submitLabel: string; showSecure?: boolean }) {
  const [d, setD] = useState<QDraft>(initial ?? blankDraft());
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const set = (p: Partial<QDraft>) => setD({ ...d, ...p });
  const toggleAnswer = (i: number) => set({ answers: d.type === "MULTI" ? (d.answers.includes(i) ? d.answers.filter((x) => x !== i) : [...d.answers, i].sort()) : [i] });
  return (
    <form className="grid" style={{ gap: 12, maxWidth: 820 }} onSubmit={async (e) => {
      e.preventDefault(); setMsg(null);
      try { await onSubmit(d); setMsg({ ok: true, t: "Saved." }); setD(blankDraft(d.subject)); } catch (er) { setMsg({ ok: false, t: (er as Error).message }); }
    }}>
      {d.replacesId && <div className="notice info">You are suggesting an improved version of an existing question.</div>}
      <div className="grid g4">
        <label className="f">Type<select value={d.type} onChange={(e) => set({ type: e.target.value as QDraft["type"], answers: e.target.value === "MULTI" ? [] : [0], ...(e.target.value === "CODE" ? { language: "python", tests: [{ input: "", expected: "", hidden: false }] } : {}) })}>
          <option value="SINGLE">Single answer</option><option value="MULTI">Multi-select</option><option value="SCENARIO">Scenario-based</option><option value="CODE">Coding</option></select></label>
        <label className="f">Subject<select value={d.subject} onChange={(e) => set({ subject: e.target.value })}>{SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.short}</option>)}</select></label>
        <label className="f">Difficulty<select value={d.difficulty} onChange={(e) => set({ difficulty: Number(e.target.value) })}><option value={1}>1 Easy</option><option value={2}>2 Medium</option><option value={3}>3 Hard</option></select></label>
        <label className="f">Skill level<select value={d.skillLevel ?? ""} onChange={(e) => set({ skillLevel: e.target.value || undefined })}><option value="">Not set</option>{SKILLS.map((s) => <option key={s}>{s}</option>)}</select></label>
      </div>
      <label className="f">Topic<input type="text" required value={d.topic} onChange={(e) => set({ topic: e.target.value })} /></label>
      {d.type === "SCENARIO" && (
        <>
          <label className="f">Scenario title<input type="text" required value={d.scenario?.title ?? ""} onChange={(e) => set({ scenario: { title: e.target.value, passage: d.scenario?.passage ?? "" } })} /></label>
          <label className="f">Scenario text (shared by its questions)<textarea required value={d.scenario?.passage ?? ""} onChange={(e) => set({ scenario: { title: d.scenario?.title ?? "", passage: e.target.value } })} /></label>
        </>
      )}
      <label className="f">Question<textarea required value={d.text} onChange={(e) => set({ text: e.target.value })} /></label>
      {d.type !== "CODE" && <label className="f">Code shown with the question (optional)<textarea value={d.code ?? ""} onChange={(e) => set({ code: e.target.value })} style={{ fontFamily: "var(--font-mono)" }} /></label>}
      {d.type === "CODE" ? (
        <>
          <div className="grid g2">
            <label className="f">Language<select value={d.language} onChange={(e) => set({ language: e.target.value })}><option value="python">Python</option><option value="cpp">C++</option><option value="java">Java</option><option value="javascript">JavaScript</option></select></label>
          </div>
          <label className="f">Starter code<textarea value={d.starterCode ?? ""} onChange={(e) => set({ starterCode: e.target.value })} style={{ fontFamily: "var(--font-mono)" }} /></label>
          <div><b className="small">Test cases</b> <span className="tiny muted">Hidden tests are used only for grading.</span></div>
          {(d.tests ?? []).map((t, i) => (
            <div className="row" key={i}>
              <input type="text" placeholder="Input" value={t.input} onChange={(e) => set({ tests: d.tests!.map((x, k) => (k === i ? { ...x, input: e.target.value } : x)) })} />
              <input type="text" placeholder="Expected output" value={t.expected} onChange={(e) => set({ tests: d.tests!.map((x, k) => (k === i ? { ...x, expected: e.target.value } : x)) })} />
              <label className="check" style={{ padding: 0 }}><input type="checkbox" checked={t.hidden} onChange={(e) => set({ tests: d.tests!.map((x, k) => (k === i ? { ...x, hidden: e.target.checked } : x)) })} /><span>Hidden</span></label>
            </div>
          ))}
          <div><button type="button" className="btn sm sec" onClick={() => set({ tests: [...(d.tests ?? []), { input: "", expected: "", hidden: true }] })}>Add test</button></div>
        </>
      ) : (
        <>
          <div className="small"><b>Options</b> <span className="muted">Tick the correct {d.type === "MULTI" ? "options (two or more)" : "option"}.</span></div>
          {d.options.map((o, i) => (
            <div className="row" key={i} style={{ flexWrap: "nowrap" }}>
              <input type={d.type === "MULTI" ? "checkbox" : "radio"} checked={d.answers.includes(i)} onChange={() => toggleAnswer(i)} aria-label={`Option ${L[i]} is correct`} />
              <input type="text" required placeholder={`Option ${L[i]}`} value={o} onChange={(e) => set({ options: d.options.map((x, k) => (k === i ? e.target.value : x)) })} />
              {d.options.length > 2 && <button type="button" className="btn ghost sm" onClick={() => set({ options: d.options.filter((_, k) => k !== i), answers: d.answers.filter((a) => a !== i).map((a) => (a > i ? a - 1 : a)) })}>Remove</button>}
            </div>
          ))}
          {d.options.length < 6 && <div><button type="button" className="btn sm sec" onClick={() => set({ options: [...d.options, ""] })}>Add option</button></div>}
        </>
      )}
      <label className="f">Explanation<textarea required value={d.explanation} onChange={(e) => set({ explanation: e.target.value })} /></label>
      {showSecure && <label className="check"><input type="checkbox" checked={!!d.secure} onChange={(e) => set({ secure: e.target.checked })} /><span>Reserve for national mocks (hidden from contributors and practice)</span></label>}
      {msg && <div className={`notice ${msg.ok ? "info" : "bad"}`}>{msg.t}</div>}
      <div><button className="btn" type="submit">{submitLabel}</button></div>
    </form>
  );
}
