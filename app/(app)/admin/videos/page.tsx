"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Page, Card, useApi, Loading, Table } from "@/components/ui";
import { SUBJECTS } from "@/lib/syllabus";

type V = { id: string; subject: string; title: string; channel: string; youtubeId: string | null; playlist: string | null; startSec: number; order: number };

/** Super admin: the videos students see in Study materials. Paste any YouTube video or playlist link. */
export default function Videos() {
  const { data, error, reload } = useApi<{ videos: V[] }>("/api/videos");
  const [msg, setMsg] = useState("");
  return (
    <Page title="Study videos" sub="Videos play inside Study materials. Paste a YouTube link to a video, a playlist, or a video with a start time (for example ...&t=1h2m5s).">
      <Card title="Add a video" style={{ marginBottom: 16 }}>
        <form className="grid g2" style={{ gap: 10 }} onSubmit={async (e) => {
          e.preventDefault(); const el = e.currentTarget; const f = new FormData(el);
          try { await api("/api/videos", { body: { subject: f.get("subject"), title: f.get("title"), channel: f.get("channel"), url: f.get("url"), order: Number(f.get("order") || 0) } }); el.reset(); setMsg("Added."); reload(); }
          catch (er) { setMsg((er as Error).message); }
        }}>
          <label className="f">Subject<select name="subject">{SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</select></label>
          <label className="f">YouTube link<input name="url" type="url" required placeholder="https://www.youtube.com/watch?v=..." /></label>
          <label className="f">Title<input name="title" required placeholder="What the student will learn" /></label>
          <label className="f">Channel or teacher<input name="channel" required placeholder="Harvard CS50, MIT OpenCourseWare..." /></label>
          <label className="f">Order (smaller shows first)<input name="order" type="number" min={0} max={999} defaultValue={50} /></label>
          <div style={{ alignSelf: "end" }}><button className="btn" type="submit">Add video</button></div>
        </form>
        {msg && <div className="notice info" style={{ marginTop: 10 }}>{msg}</div>}
      </Card>
      <Card title="All videos">
        {!data ? <Loading error={error} /> : (
          <Table rows={data.videos} empty="No videos yet." cols={[
            ["Subject", (v) => SUBJECTS.find((s) => s.key === v.subject)?.short],
            ["Title", (v) => <><b className="small">{v.title}</b><div className="tiny muted">{v.channel}</div></>],
            ["Link", (v) => <a className="tiny" target="_blank" rel="noreferrer" href={v.youtubeId ? `https://www.youtube.com/watch?v=${v.youtubeId}${v.startSec ? `&t=${v.startSec}s` : ""}` : `https://www.youtube.com/playlist?list=${v.playlist}`}>{v.youtubeId ? "Video" : "Playlist"}</a>],
            ["", (v) => <button className="btn ghost sm" onClick={async () => { if (window.confirm("Remove this video?")) { await api("/api/videos", { method: "DELETE", body: { id: v.id } }); reload(); } }}>Remove</button>],
          ]} />
        )}
      </Card>
    </Page>
  );
}
