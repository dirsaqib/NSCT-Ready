"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { api, fmtTime, SUBJECT_SHORT } from "@/components/api";
import { useT } from "@/components/Locale";

type Item = {
  position: number; questionId: string; type: "SINGLE" | "MULTI" | "SCENARIO" | "CODE"; subject: string; topic: string; text: string; code: string | null;
  scenario: { title: string; passage: string } | null; multi: boolean; selectCount: number; options: string[]; chosenSlots: number[];
  language: string | null; starterCode: string | null; sampleTests: { input: string; expected: string }[]; codeAnswer: string | null; flagged: boolean;
  correctSlots?: number[]; explanation?: string; correct?: boolean | null; credit?: number | null; codePassed?: number | null; codeTotal?: number | null; timeSec?: number;
};
type Attempt = { id: string; type: string; label: string | null; endsAt: string | null; submitted: boolean; resultsHidden?: boolean; score: number; percentile: number | null; flags: string[]; certificate: string | null; items: Item[] };
type Local = { slots: number[]; code: string; flagged: boolean; time: number; checked?: { correct: boolean; correctSlots: number[]; explanation: string } };

const L = "ABCDEF";
const deviceId = () => {
  try { let d = localStorage.getItem("nr-device"); if (!d) { d = crypto.randomUUID(); localStorage.setItem("nr-device", d); } return d; } catch { return "unknown"; }
};

export default function TestPage({ params }: { params: { id: string } }) {
  const { t } = useT();
  const { data: session } = useSession();
  const [a, setA] = useState<Attempt | null>(null);
  const [st, setSt] = useState<Local[]>([]);
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [runOut, setRunOut] = useState<string>("");
  const switches = useRef(0);
  const fsExits = useRef(0);
  const qStart = useRef(Date.now());
  const dirty = useRef(false);
  const KEY = `nr-attempt-${params.id}`;
  const practice = a?.type === "PRACTICE" || a?.type === "MISTAKES";
  const proctored = !!a && !practice;

  useEffect(() => {
    api<Attempt>(`/api/tests/${params.id}`).then((x) => {
      setA(x);
      let saved: Local[] | null = null;
      try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { /* ignore */ }
      setSt(saved && saved.length === x.items.length ? saved : x.items.map((i) => ({ slots: i.chosenSlots, code: i.codeAnswer ?? i.starterCode ?? "", flagged: i.flagged, time: 0 })));
    }).catch((e) => setErr(e.message));
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep a local copy on every change so nothing is lost if the connection or the browser drops.
  useEffect(() => { if (st.length && a && !a.submitted) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ } dirty.current = true; } }, [st]); // eslint-disable-line react-hooks/exhaustive-deps

  const payload = useCallback(() => st.map((s, i) => ({ position: i, slots: s.slots, code: s.code || undefined, flagged: s.flagged, timeSec: s.time + (i === idx ? (Date.now() - qStart.current) / 1000 : 0) })), [st, idx]);

  const save = useCallback(async () => {
    if (!a || a.submitted || practice || !dirty.current || !navigator.onLine) return;
    try { await api(`/api/tests/${a.id}/save`, { method: "PATCH", body: { answers: payload(), tabSwitches: switches.current, fullscreenExits: fsExits.current } }); dirty.current = false; setSavedAt(new Date()); } catch { /* retried next tick */ }
  }, [a, practice, payload]);

  useEffect(() => { const id = setInterval(save, 15000); return () => clearInterval(id); }, [save]);
  useEffect(() => {
    const on = () => { setOnline(true); save(); }, off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [save]);

  const submit = useCallback(async () => {
    if (!a || busy) return;
    if (!navigator.onLine) { setErr("You are offline. Your answers are safe on this device. Submit again when the connection returns."); return; }
    setBusy(true); setErr("");
    try {
      const res = await api<Attempt>(`/api/tests/${a.id}/submit`, { body: { answers: payload(), tabSwitches: switches.current, fullscreenExits: fsExits.current } });
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setA(res); window.scrollTo(0, 0);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }, [a, busy, payload]); // eslint-disable-line react-hooks/exhaustive-deps

  // Server deadline drives the timer (extra time already included). Auto-submit at zero.
  useEffect(() => {
    if (!a?.endsAt || a.submitted) return;
    const end = new Date(a.endsAt).getTime();
    const id = setInterval(() => { const s = Math.round((end - Date.now()) / 1000); setLeft(s); if (s <= 0) { clearInterval(id); submit(); } }, 500);
    return () => clearInterval(id);
  }, [a?.endsAt, a?.submitted, submit]);

  // Proctoring for timed tests: tab switches, full-screen exits, no copy, paste or right-click.
  useEffect(() => {
    if (!proctored || a?.submitted) return;
    const vis = () => { if (document.hidden) switches.current++; };
    const fs = () => { if (!document.fullscreenElement) fsExits.current++; };
    const block = (e: Event) => { const el = e.target as HTMLElement; if (el?.closest?.(".code-editor")) return; e.preventDefault(); };
    document.addEventListener("visibilitychange", vis);
    document.addEventListener("fullscreenchange", fs);
    ["copy", "cut", "paste", "contextmenu"].forEach((ev) => document.addEventListener(ev, block));
    return () => { document.removeEventListener("visibilitychange", vis); document.removeEventListener("fullscreenchange", fs); ["copy", "cut", "paste", "contextmenu"].forEach((ev) => document.removeEventListener(ev, block)); };
  }, [proctored, a?.submitted]);

  if (err && !a) return <div className="notice bad">{err}</div>;
  if (!a || !st.length) return <div className="spin" />;
  if (a.submitted && a.resultsHidden) return (
    <div className="card" style={{ maxWidth: 560, margin: "40px auto", textAlign: "center" }}>
      <h1>Test submitted</h1>
      <p>{a.label} has been submitted. Your department will release the results. You will get a notification.</p>
      <Link className="btn" href="/dashboard">Back to dashboard</Link>
    </div>
  );
  if (a.submitted) return <Report a={a} />;

  const it = a.items[idx];
  const s = st[idx];
  const go = (i: number) => {
    const now = Date.now();
    setSt((p) => p.map((x, k) => (k === idx ? { ...x, time: x.time + (now - qStart.current) / 1000 } : x)));
    qStart.current = now; setRunOut("");
    setIdx(Math.max(0, Math.min(a.items.length - 1, i)));
  };
  const patch = (v: Partial<Local>) => setSt((p) => p.map((x, k) => (k === idx ? { ...x, ...v } : x)));
  const choose = (slot: number) => {
    if (s.checked) return;
    if (it.multi) patch({ slots: s.slots.includes(slot) ? s.slots.filter((x) => x !== slot) : [...s.slots, slot] });
    else patch({ slots: [slot] });
  };
  const answered = st.filter((x, i) => (a.items[i].type === "CODE" ? x.code.trim() && x.code !== (a.items[i].starterCode ?? "") : x.slots.length)).length;
  const watermark = session?.user ? `${(session.user as { email?: string }).email ?? ""} ${(session.user as { id: string }).id.slice(-6)}` : "";

  return (
    <div style={{ position: "relative", userSelect: proctored ? "none" : undefined }}>
      {proctored && <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 4, opacity: 0.06, fontSize: 18, fontWeight: 700, transform: "rotate(-24deg)", display: "grid", placeItems: "center", whiteSpace: "pre", lineHeight: 6 }}>{Array(8).fill(watermark).join("\n")}</div>}
      <div className="exam-bar">
        <div><b>{a.label ?? a.type.replace("_", " ")}</b> · {answered}/{a.items.length} answered {savedAt && !practice && <span className="tiny" style={{ opacity: 0.8 }}>· {t("test.saved")} {savedAt.toLocaleTimeString()}</span>}</div>
        <div className="row">
          {proctored && !document.fullscreenElement && <button className="btn sm sec" onClick={() => document.documentElement.requestFullscreen().catch(() => {})}>Full screen</button>}
          {left != null && <span className={`timer ${left < 300 ? "low" : ""}`} role="timer" aria-live="off">{fmtTime(left)}</span>}
          <button className="btn sm acc" disabled={busy} onClick={() => { const un = a.items.length - answered; if (window.confirm(practice ? "Finish practice?" : `Submit now? ${un} unanswered.`)) submit(); }}>{practice ? "Finish" : t("test.submit")}</button>
        </div>
      </div>
      {!online && <div className="notice" style={{ marginBottom: 12 }}>{t("test.offline")}</div>}
      {err && <div className="notice bad" style={{ marginBottom: 12 }}>{err}</div>}
      <div className="exam">
        <div className="card">
          <div className="qmeta">
            <span className="pill">Question {idx + 1} of {a.items.length}</span><span className="pill grey">{SUBJECT_SHORT[it.subject]}</span><span className="pill grey">{it.topic}</span>
            {it.multi && <span className="pill warn">{t("test.selectAll")} ({it.selectCount})</span>}
            {it.type === "CODE" && <span className="pill warn">Coding, {it.language}</span>}
            <BookmarkButton questionId={it.questionId} />
          </div>
          {it.scenario && <div className="expl" style={{ marginBottom: 10 }}><b>{it.scenario.title}</b><div className="small" style={{ whiteSpace: "pre-wrap" }}>{it.scenario.passage}</div></div>}
          <div className="qtext" id={`q-${idx}`}>{it.text}</div>
          {it.code && <pre className="code">{it.code}</pre>}

          {it.type === "CODE" ? (
            <div style={{ marginTop: 12 }}>
              <textarea className="code-editor" aria-label="Code editor" spellCheck={false} value={s.code} onChange={(e) => patch({ code: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Tab") { e.preventDefault(); const el = e.currentTarget; const p = el.selectionStart; patch({ code: s.code.slice(0, p) + "    " + s.code.slice(el.selectionEnd) }); requestAnimationFrame(() => el.setSelectionRange(p + 4, p + 4)); } }}
                style={{ width: "100%", minHeight: 240, fontFamily: "var(--font-mono), monospace", fontSize: 14, background: "#0F1F18", color: "#DDF5E9", borderRadius: 10, padding: 14 }} />
              {it.sampleTests.length > 0 && <div className="small muted">Sample: input <code>{it.sampleTests[0].input}</code>, expected output <code>{it.sampleTests[0].expected}</code></div>}
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn sm sec" onClick={async () => {
                  setRunOut("Running...");
                  try { const r = await api<{ passed: number; total: number; results: { pass: boolean; got?: string; error?: string }[] }>(`/api/tests/${a.id}/run`, { body: { position: idx, code: s.code } }); setRunOut(`${r.passed} of ${r.total} sample tests passed.${r.results.find((x) => x.error)?.error ? "\n" + r.results.find((x) => x.error)!.error : ""}`); }
                  catch (e) { setRunOut((e as Error).message); }
                }}>Run sample tests</button>
                {practice && !s.checked && <button className="btn sm" onClick={async () => { const r = await api<{ correct: boolean; correctSlots: number[]; explanation: string }>(`/api/tests/${a.id}/check`, { body: { position: idx, code: s.code } }); patch({ checked: r }); }}>Check with all tests</button>}
              </div>
              {runOut && <pre className="ai-box" style={{ fontFamily: "var(--font-mono)" }}>{runOut}</pre>}
            </div>
          ) : (
            <div style={{ marginTop: 14 }} role={it.multi ? "group" : "radiogroup"} aria-labelledby={`q-${idx}`}>
              {it.options.map((o, slot) => {
                let cls = s.slots.includes(slot) ? "sel" : "";
                if (s.checked) cls = s.checked.correctSlots.includes(slot) ? "ok" : s.slots.includes(slot) ? "no" : "";
                return (
                  <button key={slot} className={`opt ${cls}`} disabled={!!s.checked} onClick={() => choose(slot)} role={it.multi ? "checkbox" : "radio"} aria-checked={s.slots.includes(slot)}>
                    <span className="l">{it.multi ? (s.slots.includes(slot) ? "✓" : L[slot]) : L[slot]}</span><span>{o}</span>
                  </button>
                );
              })}
            </div>
          )}

          {s.checked && <div className="expl"><b>{s.checked.correct ? "Correct." : "Not quite."}</b> {s.checked.explanation}</div>}
          <div className="row between" style={{ marginTop: 16 }}>
            <div className="row">
              <button className="btn sec sm" disabled={idx === 0} onClick={() => go(idx - 1)}>{t("test.previous")}</button>
              {!practice && <button className="btn sec sm" onClick={() => patch({ flagged: !s.flagged })}>{s.flagged ? "Unflag" : t("test.flag")}</button>}
              {!practice && it.type !== "CODE" && <button className="btn ghost sm" onClick={() => patch({ slots: [] })}>Clear</button>}
            </div>
            {practice && !s.checked && it.type !== "CODE" ? (
              <button className="btn" disabled={!s.slots.length} onClick={async () => { const r = await api<{ correct: boolean; correctSlots: number[]; explanation: string }>(`/api/tests/${a.id}/check`, { body: { position: idx, slots: s.slots } }); patch({ checked: r }); }}>Check answer</button>
            ) : (
              <button className="btn" onClick={() => (idx === a.items.length - 1 ? submit() : go(idx + 1))}>{idx === a.items.length - 1 ? t("test.submit") : t("test.next")}</button>
            )}
          </div>
        </div>
        <div className="card">
          <h3>Question palette</h3>
          <div className="pal">{st.map((x, i) => <button key={i} aria-label={`Question ${i + 1}`} onClick={() => go(i)} className={`${x.slots.length || (a.items[i].type === "CODE" && x.code.trim() && x.code !== (a.items[i].starterCode ?? "")) ? "a" : ""} ${x.flagged ? "f" : ""} ${i === idx ? "cur" : ""}`}>{i + 1}</button>)}</div>
          <div className="legend"><span><i style={{ background: "var(--brand)" }} />Answered</span><span><i style={{ background: "var(--accent)", borderRadius: "50%" }} />Flagged</span></div>
          {proctored && <p className="tiny muted" style={{ marginTop: 12 }}>This test is proctored: tab switches and leaving full screen are recorded. Copying is disabled.</p>}
        </div>
      </div>
    </div>
  );
}

function BookmarkButton({ questionId }: { questionId: string }) {
  const [saved, setSaved] = useState(false);
  return <button className="btn ghost sm" style={{ marginInlineStart: "auto" }} onClick={async () => { await api("/api/bookmarks", { method: saved ? "DELETE" : "POST", body: { questionId } }); setSaved(!saved); }}>{saved ? "Saved" : "Save question"}</button>;
}

function AiExplain({ attemptId, position }: { attemptId: string; position: number }) {
  const [txt, setTxt] = useState("");
  const [lang, setLang] = useState("English");
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <div className="row">
        <button className="btn ghost sm" disabled={busy} onClick={async () => { setBusy(true); try { setTxt((await api<{ text: string }>("/api/ai/explain", { body: { attemptId, position, lang } })).text); } catch (e) { setTxt((e as Error).message); } setBusy(false); }}>{busy ? "Thinking..." : "Explain with AI tutor"}</button>
        <select value={lang} onChange={(e) => setLang(e.target.value)} style={{ width: "auto" }}>{["English", "Urdu", "Roman Urdu"].map((l) => <option key={l}>{l}</option>)}</select>
      </div>
      {txt && <div className="ai-box">{txt}</div>}
    </div>
  );
}

function Recheck({ attemptId, position }: { attemptId: string; position: number }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  if (msg) return <div className="small" style={{ color: "var(--good)" }}>{msg}</div>;
  if (!open) return <button className="btn ghost sm" style={{ color: "var(--muted)" }} onClick={() => setOpen(true)}>Request a re-check</button>;
  return (
    <form className="row" onSubmit={async (e) => { e.preventDefault(); const reason = String(new FormData(e.currentTarget).get("r")); try { await api(`/api/tests/${attemptId}/recheck`, { body: { position, reason } }); setMsg("Re-check requested. You will be notified of the answer."); } catch (er) { setMsg((er as Error).message); } }}>
      <input name="r" type="text" required minLength={5} placeholder="Why do you think this is marked wrongly?" />
      <button className="btn sm" type="submit">Send</button>
    </form>
  );
}

function Report({ a }: { a: Attempt }) {
  const [f, setF] = useState<"all" | "wrong" | "flag">("all");
  const [cert, setCert] = useState<{ code: string; url: string; qr: string } | null>(null);
  const [certErr, setCertErr] = useState("");
  const isPractice = a.type === "PRACTICE" || a.type === "MISTAKES";
  const items = a.items.filter((i) => i.correct != null || !isPractice);
  const correct = items.filter((i) => i.correct).length;
  const by: Record<string, [number, number]> = {};
  items.forEach((i) => { const b = (by[i.subject] ??= [0, 0]); b[1]++; b[0] += i.credit ?? 0; });
  const canCert = ["DIAGNOSTIC", "MOCK", "NATIONAL_MOCK", "EMPLOYER_ASSESSMENT"].includes(a.type) && !a.label;
  return (
    <>
      <div className="top"><div><h1>Your result</h1><p className="sub">{a.label ?? a.type.replace("_", " ")}</p></div>
        <div className="row">
          {canCert && !cert && <button className="btn sec" onClick={async () => { try { setCert(await api(`/api/tests/${a.id}/certificate`, { method: "POST" })); } catch (e) { setCertErr((e as Error).message); } }}>Get certificate</button>}
          <Link className="btn" href="/results">See my progress</Link>
        </div>
      </div>
      {certErr && <div className="notice bad" style={{ marginBottom: 12 }}>{certErr}</div>}
      {a.flags.length > 0 && <div className="notice" style={{ marginBottom: 12 }}>This test is under integrity review ({a.flags.join(", ").toLowerCase().replace(/_/g, " ")}). Your score is kept but a certificate waits for review.</div>}
      {cert && (
        <div className="card" style={{ marginBottom: 16, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div dangerouslySetInnerHTML={{ __html: cert.qr }} />
          <div><h2 style={{ margin: 0 }}>Certificate {cert.code}</h2><p className="small">Anyone can verify it by scanning the QR code or opening <a href={cert.url}>{cert.url}</a>.</p></div>
        </div>
      )}
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card stat"><div className="k">Score</div><div className="v">{a.score}%</div><div className="d">{correct} of {items.length} fully correct</div></div>
        <div className="card stat"><div className="k">Percentile</div><div className="v">{a.percentile ?? "n/a"}</div><div className="d">better than {a.percentile ?? "?"}% of students (30 days)</div></div>
        <div className="card stat"><div className="k">Time used</div><div className="v">{fmtTime(items.reduce((s, i) => s + (i.timeSec ?? 0), 0))}</div></div>
        <div className="card stat"><div className="k">Left blank</div><div className="v">{items.filter((i) => !i.chosenSlots.length && !i.codeAnswer).length}</div></div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>By subject</h2>
        <div className="bars">{Object.entries(by).map(([k, [c, t]]) => { const p = Math.round((100 * c) / t); return <div className="bar-row" key={k}><div><b>{SUBJECT_SHORT[k]}</b> <span className="muted tiny">{c.toFixed(1)}/{t}</span></div><div className="bar"><i className={p >= 70 ? "" : p >= 50 ? "w" : "b"} style={{ width: `${p}%` }} /></div><div className="small">{p}%</div></div>; })}</div>
      </div>
      <div className="card">
        <div className="tabs">{(["all", "wrong", "flag"] as const).map((x) => <button key={x} className={f === x ? "on" : ""} onClick={() => setF(x)}>{x === "all" ? "All" : x === "wrong" ? "Wrong" : "Flagged"}</button>)}</div>
        <div className="qlist">
          {items.filter((i) => f === "all" || (f === "wrong" && !i.correct) || (f === "flag" && i.flagged)).map((i) => (
            <div className="q" key={i.position}>
              <div className="qmeta"><span className={`pill ${i.correct ? "" : "bad"}`}>{i.correct ? "Correct" : (i.credit ?? 0) > 0 ? `Partly correct (${Math.round((i.credit ?? 0) * 100)}%)` : !i.chosenSlots.length && !i.codeAnswer ? "Not answered" : "Wrong"}</span><span className="pill grey">Q{i.position + 1} · {SUBJECT_SHORT[i.subject]}</span><BookmarkButton questionId={i.questionId} /></div>
              {i.scenario && <div className="small muted">{i.scenario.title}</div>}
              <b>{i.text}</b>
              {i.code && <pre className="code">{i.code}</pre>}
              {i.type === "CODE" ? (
                <div className="small">Tests passed: <b>{i.codePassed ?? 0} of {i.codeTotal ?? 0}</b>{i.codeAnswer && <pre className="code">{i.codeAnswer}</pre>}</div>
              ) : (
                <div className="small">
                  {i.chosenSlots.length > 0 && !i.correct && <>Your answer: <span style={{ color: "var(--bad)" }}>{i.chosenSlots.map((x) => i.options[x]).join(", ")}</span><br /></>}
                  Correct answer: <b style={{ color: "var(--good)" }}>{(i.correctSlots ?? []).map((x) => i.options[x]).join(", ")}</b>
                </div>
              )}
              <div className="expl">{i.explanation}</div>
              {!i.correct && <div className="row"><AiExplain attemptId={a.id} position={i.position} />{!isPractice && <Recheck attemptId={a.id} position={i.position} />}</div>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
