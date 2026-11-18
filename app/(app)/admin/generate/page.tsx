"use client";
import { useRef, useState } from "react";
import { api } from "@/components/api";
import { Page, Card, useApi, Loading, Table } from "@/components/ui";
import { SUBJECTS } from "@/lib/syllabus";

type Data = { rows: { subject: string; status: string; _count: number }[]; aiReady: boolean };

/**
 * Super admin: grow the national bank with AI, 10 questions per batch, in a loop you can stop.
 * With double-check on, a second model must agree with the answer key before a question goes live.
 */
export default function Generate() {
  const { data, error, reload } = useApi<Data>("/api/admin/generate");
  const [subject, setSubject] = useState("PS");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [batches, setBatches] = useState(10);
  const [autoPublish, setAuto] = useState(true);
  const [target, setTarget] = useState(80000);
  const [run, setRun] = useState<{ done: number; live: number; review: number; duplicate: number; failed: number } | null>(null);
  const [msg, setMsg] = useState("");
  const stop = useRef(false);
  const [running, setRunning] = useState(false);

  const start = async () => {
    stop.current = false; setMsg(""); setRunning(true);
    const t = { done: 0, live: 0, review: 0, duplicate: 0, failed: 0 };
    setRun({ ...t });
    for (let i = 0; i < batches && !stop.current; i++) {
      try {
        const r = await api<{ live: number; review: number; duplicate: number; failed: number }>("/api/admin/generate", { body: { subject, topic: topic.trim() || undefined, count: 10, autoPublish, difficulty: difficulty ? Number(difficulty) : undefined } });
        t.done++; t.live += r.live; t.review += r.review; t.duplicate += r.duplicate; t.failed += r.failed;
        setRun({ ...t });
      } catch (e) { setMsg((e as Error).message); break; }
    }
    setRunning(false);
    reload();
  };

  const count = (s: string, st: string) => data?.rows.find((r) => r.subject === s && r.status === st)?._count ?? 0;
  const waiting = (s: string) => (data?.rows ?? []).filter((r) => r.subject === s && !["LIVE", "RETIRED"].includes(r.status)).reduce((n, r) => n + r._count, 0);

  return (
    <Page title="AI question generator" sub="Grow each subject towards its target. Every question is checked for duplicates, and with double-check on, a second AI model must agree with the answer before it goes live. The rest wait in Question bank, Review.">
      {!data ? <Loading error={error} /> : (
        <>
          {!data.aiReady && <div className="notice bad" style={{ marginBottom: 12 }}>Add ANTHROPIC_API_KEY in Vercel, Environment Variables, then redeploy. The generator needs it.</div>}
          <Card title="Generate" style={{ marginBottom: 16 }}>
            <div className="grid g3" style={{ gap: 10 }}>
              <label className="f">Subject<select value={subject} onChange={(e) => setSubject(e.target.value)}>{SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</select></label>
              <label className="f">Topic (optional)<input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Leave empty for mixed topics" /></label>
              <label className="f">Difficulty<select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="">Mixed</option><option value="1">1, easy</option><option value="2">2, medium</option><option value="3">3, hard</option></select></label>
              <label className="f">Batches of 10<input type="number" min={1} max={500} value={batches} onChange={(e) => setBatches(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} /></label>
              <label className="check" style={{ alignSelf: "end" }}><input type="checkbox" checked={autoPublish} onChange={(e) => setAuto(e.target.checked)} /><span className="small">Publish when the second AI agrees (double-check)</span></label>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={start} disabled={!data.aiReady || running}>{running ? "Generating..." : `Generate ${batches * 10} questions`}</button>
              <button className="btn ghost" onClick={() => { stop.current = true; }}>Stop</button>
            </div>
            {run && <p className="small" style={{ marginTop: 10 }}>Batch {run.done} of {batches}: <b>{run.live}</b> live, <b>{run.review}</b> waiting for review, {run.duplicate} duplicates skipped, {run.failed} rejected.</p>}
            {msg && <div className="notice bad">{msg}</div>}
            <p className="tiny muted">Keep this tab open while it runs. Each batch takes about 20 to 40 seconds and uses your Anthropic credit. Start with a small run and check quality in Question bank before running large batches.</p>
          </Card>
          <Card title="Bank size" right={<label className="small">Target per subject <input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value) || 0)} style={{ width: 100 }} /></label>}>
            <Table rows={SUBJECTS} cols={[
              ["Subject", (s) => s.name],
              ["Live", (s) => <b>{count(s.key, "LIVE").toLocaleString()}</b>],
              ["Waiting for review", (s) => waiting(s.key).toLocaleString()],
              ["Progress to target", (s) => { const p = target ? Math.min(100, (100 * count(s.key, "LIVE")) / target) : 0; return <div style={{ width: 160, height: 8, background: "#EDF1EE", borderRadius: 9 }}><div style={{ width: `${p}%`, height: 8, background: "var(--brand)", borderRadius: 9 }} /></div>; }],
            ]} />
          </Card>
        </>
      )}
    </Page>
  );
}
