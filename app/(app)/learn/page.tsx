"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import StartButton from "@/components/StartButton";
import { api } from "@/components/api";
import { Page, useApi, Loading } from "@/components/ui";
import { SUBJECTS } from "@/lib/syllabus";

type Lesson = { id: string; subject: string; topic: string; title: string; notes: string; videoUrl: string | null };
type Video = { id: string; subject: string; title: string; channel: string; youtubeId: string | null; playlist: string | null; startSec: number };

const src = (v: Video) =>
  v.youtubeId
    ? `https://www.youtube-nocookie.com/embed/${v.youtubeId}?rel=0${v.startSec ? `&start=${v.startSec}` : ""}${v.playlist ? `&list=${v.playlist}` : ""}`
    : `https://www.youtube-nocookie.com/embed/videoseries?list=${v.playlist}&rel=0`;

/** Study materials: top video lectures, played right here, plus short notes per topic. */
export default function Learn() {
  const [sub, setSub] = useState("PS");
  useEffect(() => { const s = new URLSearchParams(location.search).get("subject"); if (s && SUBJECTS.some((x) => x.key === s)) setSub(s); }, []);
  const videos = useApi<{ videos: Video[] }>(`/api/videos?subject=${sub}`, [sub]);
  const lessons = useApi<{ lessons: Lesson[] }>(`/api/lessons?subject=${sub}`, [sub]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const s = SUBJECTS.find((x) => x.key === sub)!;
  const byTopic = new Map<string, Lesson[]>();
  lessons.data?.lessons.forEach((l) => byTopic.set(l.topic, [...(byTopic.get(l.topic) ?? []), l]));
  const play = (v: Video) => { setPlaying(v.id); api("/api/videos/view", { body: { id: v.id } }).catch(() => {}); };

  return (
    <Page title="Study materials" sub="Watch top video lectures without leaving the site, read short notes, then practise.">
      <div className="tabs">{SUBJECTS.map((x) => <button key={x.key} className={sub === x.key ? "on" : ""} onClick={() => { setSub(x.key); setPlaying(null); }}>{x.short} <span className="tiny muted">{x.weight}%</span></button>)}</div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row between"><div><h2 style={{ margin: 0 }}>{s.name}</h2><p className="small muted" style={{ margin: "4px 0 0" }}>{s.weight}% of the NSCT</p></div>
          <div className="row"><StartButton type="PRACTICE" subject={sub} count={10} label="Quick practice" className="btn sm sec" /></div></div>
      </div>

      <h3>Video lectures</h3>
      {!videos.data ? <Loading error={videos.error} /> : videos.data.videos.length === 0 ? <div className="card empty" style={{ marginBottom: 16 }}>Videos for this subject are being added.</div> : (
        <div className="grid g2" style={{ marginBottom: 20 }}>
          {videos.data.videos.map((v) => (
            <div key={v.id} className="card" style={{ padding: 12 }}>
              {playing === v.id
                ? <div className="video"><iframe src={src(v)} title={v.title} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
                : (
                  <button onClick={() => play(v)} className="video" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", cursor: "pointer", border: 0, position: "relative", backgroundImage: v.youtubeId ? `url(https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg)` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
                    <span style={{ background: "rgba(0,0,0,.65)", color: "#fff", borderRadius: 99, width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>▶</span>
                    {v.playlist && !v.youtubeId && <span style={{ position: "absolute", bottom: 8, left: 10, color: "#fff", fontSize: 12 }}>Playlist</span>}
                  </button>
                )}
              <b className="small" style={{ display: "block", marginTop: 8 }}>{v.title}</b>
              <span className="tiny muted">{v.channel}{v.startSec ? `, starts at ${Math.floor(v.startSec / 3600)}:${String(Math.floor((v.startSec % 3600) / 60)).padStart(2, "0")}` : ""}{v.playlist ? ", full playlist" : ""}</span>
            </div>
          ))}
        </div>
      )}

      <h3>Notes by topic</h3>
      {!lessons.data ? <Loading error={lessons.error} /> : byTopic.size === 0 ? <div className="card empty">Notes for this subject are being added.</div> : (
        <div className="grid" style={{ gap: 12 }}>
          {[...byTopic.entries()].map(([topic, ls]) => (
            <div className="card" key={topic}>
              <div className="row between"><h3 style={{ margin: 0 }}>{topic}</h3><StartButton type="PRACTICE" subject={sub} topic={topic} count={10} label="Practise this topic" className="btn sm sec" /></div>
              {ls.map((l) => (
                <div key={l.id} style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10 }}>
                  <button className="btn ghost sm" onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? "Hide" : "Read"}: {l.title}</button>
                  {open === l.id && <div className="small" style={{ whiteSpace: "pre-wrap", margin: "8px 0" }}>{l.notes}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
