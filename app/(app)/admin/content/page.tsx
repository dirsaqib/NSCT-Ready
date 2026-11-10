"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { SUBJECTS } from "@/lib/syllabus";
import { Page, Card, useApi, Loading, Table, Tabs, Pill, JsonForm, fmtDate } from "@/components/ui";

type Lesson = { id: string; subject: string; topic: string; title: string; videoUrl: string | null };
type Faq = { id: string; category: string; question: string; answer: string };
type Survey = { id: string; title: string; audience: string; active: boolean; count: number; summary: { q: string; avg?: number | null; samples?: string[] }[] };
type Ev = { id: string; title: string; date: string; venue: string | null; sponsor: { name: string } | null; awards: { title: string; rank: number }[] };

/** Lessons, FAQ, surveys, and award events for top performers. */
export default function Content() {
  const [tab, setTab] = useState<"lessons" | "faq" | "surveys" | "events">("lessons");
  const lessons = useApi<{ lessons: Lesson[] }>(tab === "lessons" ? "/api/lessons" : null, [tab]);
  const faq = useApi<{ faqs: Faq[] }>(tab === "faq" ? "/api/faq" : null, [tab]);
  const surveys = useApi<{ surveys: Survey[] }>(tab === "surveys" ? "/api/surveys" : null, [tab]);
  const events = useApi<{ events: Ev[] }>(tab === "events" ? "/api/admin/content" : null, [tab]);
  const sponsors = useApi<{ sponsors: { id: string; name: string }[] }>(tab === "events" ? "/api/admin/business" : null, [tab]);
  const del = async (path: string, id: string, reload: () => void) => { if (window.confirm("Delete?")) { await api(path, { method: "DELETE", body: { id } }); reload(); } };
  return (
    <Page title="Lessons, FAQ, surveys and events" sub="Everything students read, plus feedback and awards.">
      <div className="card">
        <Tabs value={tab} onChange={setTab} tabs={[["lessons", "Lessons"], ["faq", "FAQ"], ["surveys", "Surveys"], ["events", "Events and awards"]]} />
        {tab === "lessons" && (
          <div className="grid g2">
            {!lessons.data ? <Loading error={lessons.error} /> : <Table rows={lessons.data.lessons} empty="No lessons yet." cols={[["Subject", (l) => <Pill tone="grey">{l.subject}</Pill>], ["Topic", (l) => l.topic], ["Title", (l) => <b>{l.title}</b>], ["Video", (l) => (l.videoUrl ? "Yes" : "")], ["", (l) => <button className="btn ghost sm" onClick={() => del("/api/lessons", l.id, lessons.reload)}>Delete</button>]]} />}
            <JsonForm submit="Add lesson" onSubmit={async (v) => { await api("/api/lessons", { body: { subject: v.subject, topic: v.topic, title: v.title, notes: v.notes, videoUrl: v.videoUrl, order: Number(v.order || 0) } }); lessons.reload(); }}>
              <div className="grid g2"><label className="f">Subject<select name="subject">{SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.short}</option>)}</select></label><label className="f">Topic<input name="topic" type="text" required /></label></div>
              <label className="f">Title<input name="title" type="text" required /></label>
              <label className="f">Notes (Markdown)<textarea name="notes" required minLength={10} rows={8} /></label>
              <div className="grid g2"><label className="f">Video link (YouTube)<input name="videoUrl" type="url" /></label><label className="f">Order<input name="order" type="number" defaultValue={0} /></label></div>
            </JsonForm>
          </div>
        )}
        {tab === "faq" && (
          <div className="grid g2">
            {!faq.data ? <Loading error={faq.error} /> : <div>{faq.data.faqs.map((f) => <div className="q" key={f.id}><Pill tone="grey">{f.category}</Pill> <b>{f.question}</b><div className="small">{f.answer}</div><button className="btn ghost sm" onClick={() => del("/api/faq", f.id, faq.reload)}>Delete</button></div>)}</div>}
            <JsonForm submit="Add FAQ" onSubmit={async (v) => { await api("/api/faq", { body: { category: v.category, question: v.question, answer: v.answer, order: Number(v.order || 0) } }); faq.reload(); }}>
              <label className="f">Category<input name="category" type="text" required placeholder="Account, Tests, Payments" /></label>
              <label className="f">Question<input name="question" type="text" required /></label>
              <label className="f">Answer<textarea name="answer" required /></label>
              <label className="f">Order<input name="order" type="number" defaultValue={0} /></label>
            </JsonForm>
          </div>
        )}
        {tab === "surveys" && (
          <div className="grid g2">
            {!surveys.data ? <Loading error={surveys.error} /> : <div>{surveys.data.surveys.map((s) => (
              <div className="q" key={s.id}>
                <div className="row between"><b>{s.title}</b><button className="btn ghost sm" onClick={async () => { await api("/api/surveys", { body: { kind: "toggle", surveyId: s.id } }); surveys.reload(); }}>{s.active ? "Close" : "Reopen"}</button></div>
                <div className="tiny muted">{s.audience.toLowerCase()} · {s.count} responses</div>
                {s.summary.map((x, i) => <div key={i} className="small">{x.q}: <b>{x.avg != null ? `${x.avg} of 5` : x.samples?.slice(0, 3).join(" | ") || "no answers"}</b></div>)}
              </div>
            ))}</div>}
            <JsonForm submit="Create survey" onSubmit={async (v) => { await api("/api/surveys", { body: { kind: "create", title: v.title, audience: v.audience, questions: v.questions.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => (l.startsWith("text:") ? { q: l.slice(5).trim(), type: "text" } : { q: l, type: "scale" })) } }); surveys.reload(); }}>
              <label className="f">Title<input name="title" type="text" required /></label>
              <label className="f">Audience<select name="audience"><option value="STUDENT">Students</option><option value="UNIVERSITY">University staff</option><option value="ALL">Everyone</option></select></label>
              <label className="f">Questions, one per line. Start with text: for a written answer, otherwise it is a 1 to 5 rating.<textarea name="questions" required rows={6} placeholder={"How useful were the mock tests?\ntext: What should we add?"} /></label>
            </JsonForm>
          </div>
        )}
        {tab === "events" && (
          <div className="grid g2">
            {!events.data ? <Loading error={events.error} /> : <Table rows={events.data.events} empty="No events yet." cols={[["Event", (e) => <b>{e.title}</b>], ["Date", (e) => fmtDate(e.date)], ["Venue", (e) => e.venue], ["Sponsor", (e) => e.sponsor?.name], ["Awards", (e) => e.awards.length]]} />}
            <JsonForm submit="Save event" onSubmit={async (v) => {
              const awards = v.awards.split("\n").map((l) => l.trim()).filter(Boolean).map((l, i) => { const [title, userId] = l.split("|").map((x) => x.trim()); return { title, rank: i + 1, ...(userId ? { userId } : {}) }; });
              await api("/api/admin/content", { body: { title: v.title, date: v.date, venue: v.venue || undefined, sponsorId: v.sponsorId || null, awards, notifyWinners: !!v.notify } }); events.reload();
            }}>
              <label className="f">Title<input name="title" type="text" required placeholder="NSCT Ready Top Performers 2027" /></label>
              <div className="grid g2"><label className="f">Date<input name="date" type="date" required /></label><label className="f">Venue<input name="venue" type="text" /></label></div>
              <label className="f">Sponsor<select name="sponsorId"><option value="">None</option>{sponsors.data?.sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label className="f">Awards, one per line in rank order. Add | and the student&apos;s user id to link a winner.<textarea name="awards" rows={5} placeholder={"National topper | clx123...\nBest female performer"} /></label>
              <label className="check"><input type="checkbox" name="notify" value="1" /><span>Notify linked winners by email and SMS</span></label>
            </JsonForm>
          </div>
        )}
      </div>
    </Page>
  );
}
