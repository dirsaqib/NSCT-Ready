"use client";
import { useState } from "react";
import StartButton from "@/components/StartButton";
import { Page, useApi, Loading } from "@/components/ui";
import { SUBJECTS } from "@/lib/syllabus";

type Lesson = { id: string; subject: string; topic: string; title: string; notes: string; videoUrl: string | null };

/** NSCT syllabus by domain and topic, with short notes and video lessons. */
export default function Learn() {
  const [sub, setSub] = useState("PS");
  const { data, error } = useApi<{ lessons: Lesson[] }>(`/api/lessons?subject=${sub}`, [sub]);
  const [open, setOpen] = useState<string | null>(null);
  const s = SUBJECTS.find((x) => x.key === sub)!;
  const byTopic = new Map<string, Lesson[]>();
  data?.lessons.forEach((l) => byTopic.set(l.topic, [...(byTopic.get(l.topic) ?? []), l]));
  const embed = (u: string) => { const m = u.match(/(?:youtu\.be\/|v=)([\w-]{11})/); return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null; };
  return (
    <Page title="Syllabus and lessons" sub="All 10 NSCT domains with short notes and videos. Practise each topic right after reading.">
      <div className="tabs">{SUBJECTS.map((x) => <button key={x.key} className={sub === x.key ? "on" : ""} onClick={() => setSub(x.key)}>{x.short} <span className="tiny muted">{x.weight}%</span></button>)}</div>
      <div className="card" style={{ marginBottom: 16 }}><h2 style={{ margin: 0 }}>{s.name}</h2><p className="muted" style={{ margin: "4px 0 0" }}>{s.weight}% of the NSCT.</p></div>
      {!data ? <Loading error={error} /> : byTopic.size === 0 ? <div className="card empty">Lessons for this domain are being added. Use topic practice meanwhile.</div> : (
        <div className="grid" style={{ gap: 12 }}>
          {[...byTopic.entries()].map(([topic, ls]) => (
            <div className="card" key={topic}>
              <div className="row between"><h3 style={{ margin: 0 }}>{topic}</h3><StartButton type="PRACTICE" subject={sub} topic={topic} label="Practise this topic" className="btn sm sec" /></div>
              {ls.map((l) => (
                <div key={l.id} style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10 }}>
                  <button className="btn ghost sm" onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? "Hide" : "Read"}: {l.title}</button>
                  {open === l.id && (
                    <div>
                      <div className="small" style={{ whiteSpace: "pre-wrap", margin: "8px 0" }}>{l.notes}</div>
                      {l.videoUrl && (embed(l.videoUrl) ? <iframe title={l.title} src={embed(l.videoUrl)!} width="100%" height="315" style={{ border: 0, borderRadius: 10 }} allowFullScreen /> : <a href={l.videoUrl} target="_blank" rel="noreferrer">Watch video</a>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
