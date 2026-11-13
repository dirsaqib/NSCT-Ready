"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/api";
import { Page, Card, Stat, useApi, Loading, Table, Pill, fmtDateTime, upload } from "@/components/ui";

type Row = { userId: string; name: string; roll: string; section: string | null; program: string; state: string; seat: string | null; ip: string | null; answered: number; total: number; tabSwitches: number; fullscreenExits: number; flags: string[]; score: number | null; lastSavedAt: string | null };
type D = {
  test: { id: string; title: string; mode: "ONLINE_LAB" | "OFFLINE_LAN"; status: string; accessCode: string; opensAt: string; closesAt: string; durationMin: number; extraMin: number; lateJoinMin: number; ipAllowlist: string[]; passMark: number; resultsReleased: boolean; packagedAt: string | null; resultsImportedAt: string | null; wentLiveAt: string | null };
  paper: { id: string; subject: string; topic: string; type: string; text: string }[];
  rows: Row[];
  summary: { expected: number; notStarted: number; inProgress: number; disconnected: number; submitted: number; average: number | null; passed: number };
};
const STATE: Record<string, [string, "warn" | "bad" | "grey" | undefined]> = { NOT_STARTED: ["Not started", "grey"], IN_PROGRESS: ["Writing", "warn"], DISCONNECTED: ["No signal 90s+", "bad"], SUBMITTED: ["Submitted", undefined] };

/** Invigilator screen: access code, live student grid, controls, offline package and results import. */
export default function LabTest({ params }: { params: { id: string } }) {
  const r = useRouter();
  const { data: d, error, reload } = useApi<D>(`/api/labtests/${params.id}`);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("");
  const [big, setBig] = useState(false);
  useEffect(() => { if (d?.test.status !== "LIVE") return; const t = setInterval(reload, 5000); return () => clearInterval(t); }, [d?.test.status, reload]);
  if (!d) return <Loading error={error} />;
  const t = d.test, s = d.summary;
  const act = async (body: object, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try { await api(`/api/labtests/${t.id}`, { method: "PATCH", body }); setMsg(""); reload(); } catch (e) { setMsg((e as Error).message); }
  };
  const rows = d.rows.filter((x) => !filter || x.state === filter);

  if (big) return (
    <div style={{ position: "fixed", inset: 0, background: "#0B3B2C", color: "#fff", zIndex: 100, display: "grid", placeItems: "center", textAlign: "center" }} onClick={() => setBig(false)}>
      <div>
        <div style={{ fontSize: 28, opacity: 0.8 }}>{t.title}</div>
        <div style={{ fontSize: 22, margin: "18px 0 6px" }}>Sign in to NSCT Ready, open <b>Mock tests</b>, then <b>Lab test</b>, and enter:</div>
        <div style={{ fontSize: 140, fontWeight: 800, letterSpacing: 18, fontFamily: "var(--font-mono)" }}>{t.accessCode}</div>
        <div style={{ fontSize: 22, opacity: 0.8 }}>{t.durationMin + t.extraMin} minutes. Phones away. Tab switches are recorded.</div>
        <div style={{ fontSize: 14, opacity: 0.6, marginTop: 30 }}>Click anywhere to close</div>
      </div>
    </div>
  );

  return (
    <Page title={t.title} sub={`${t.mode === "ONLINE_LAB" ? "Online lab (CBT)" : "Offline on the lab network"} · ${fmtDateTime(t.opensAt)} to ${fmtDateTime(t.closesAt)} · ${t.durationMin}${t.extraMin ? ` + ${t.extraMin}` : ""} minutes`}
      actions={<button className="btn sec" onClick={() => r.push("/labtests")}>All lab tests</button>}>
      {msg && <div className="notice bad" style={{ marginBottom: 12 }}>{msg}</div>}

      {t.mode === "ONLINE_LAB" ? (
        <Card style={{ marginBottom: 16, borderColor: t.status === "LIVE" ? "var(--accent)" : undefined }}>
          <div className="row between">
            <div>
              <div className="small muted">Access code for the board</div>
              <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 6, fontFamily: "var(--font-mono)" }}>{t.accessCode}</div>
              <div className="tiny muted">{t.ipAllowlist.length ? `Locked to: ${t.ipAllowlist.join(", ")}` : "Not locked to a network. Any device with the code can enter."}</div>
            </div>
            <div className="row">
              <button className="btn sec" onClick={() => setBig(true)}>Show on projector</button>
              <button className="btn ghost" onClick={() => act({ action: "newCode" }, "Make a new code? The old one stops working for new starts.")}>New code</button>
              {t.status === "SCHEDULED" && <button className="btn acc" onClick={() => act({ action: "start" }, "Start the test now? Students can enter with the code.")}>Start test</button>}
              {t.status === "LIVE" && <>
                <button className="btn sec" onClick={() => { const m = window.prompt("Add how many minutes for everyone?", "10"); if (m) act({ action: "extend", minutes: Number(m) }); }}>Add time</button>
                <button className="btn" style={{ background: "var(--bad)" }} onClick={() => act({ action: "close" }, "End the test for everyone? Every unsubmitted test is submitted with its saved answers.")}>End test for all</button>
              </>}
            </div>
          </div>
          {t.status === "LIVE" && t.wentLiveAt && <p className="small" style={{ marginBottom: 0 }}>Live since {fmtDateTime(t.wentLiveAt)}. New starts close {t.lateJoinMin} minutes after that. This page refreshes every 5 seconds.</p>}
        </Card>
      ) : (
        <OfflinePanel t={t} onChange={reload} setMsg={setMsg} />
      )}

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat k="Expected" v={s.expected} d={`${s.notStarted} not started`} />
        <Stat k="Writing" v={s.inProgress} d={s.disconnected ? `${s.disconnected} with no signal` : "all connected"} />
        <Stat k="Submitted" v={s.submitted} d={`${s.expected ? Math.round((100 * s.submitted) / s.expected) : 0}% of class`} />
        <Stat k="Average" v={s.average == null ? "n/a" : `${s.average}%`} d={`${s.passed} passed at ${t.passMark}%`} />
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="row">{[["", "All"], ["IN_PROGRESS", "Writing"], ["DISCONNECTED", "No signal"], ["NOT_STARTED", "Not started"], ["SUBMITTED", "Submitted"]].map(([k, l]) => <button key={k} className={`btn sm ${filter === k ? "" : "sec"}`} onClick={() => setFilter(k)}>{l}</button>)}</div>
          {t.status === "CLOSED" && (t.resultsReleased ? <Pill>Results released</Pill> : <button className="btn" onClick={() => act({ action: "release", notifyStudents: true }, "Release results to students now?")}>Release results to students</button>)}
        </div>
        <Table rows={rows} empty="Nobody in this view." cols={[
          ["Student", (x) => <><b>{x.name}</b><div className="tiny muted">{x.roll} · {x.program} {x.section ?? ""}</div></>],
          ["Status", (x) => <Pill tone={STATE[x.state][1]}>{STATE[x.state][0]}</Pill>],
          ["Answered", (x) => (x.state === "NOT_STARTED" ? "" : `${x.answered} / ${x.total}`)],
          ["Integrity", (x) => (x.tabSwitches || x.fullscreenExits || x.flags.length ? <span className="small" style={{ color: "var(--bad)" }}>{x.tabSwitches} tabs, {x.fullscreenExits} full-screen exits{x.flags.length ? `, ${x.flags.length} flags` : ""}</span> : x.state === "NOT_STARTED" ? "" : "Clean")],
          ["Seat · IP", (x) => <span className="tiny">{x.seat ?? ""} {x.ip ?? ""}</span>],
          ["Score", (x) => (x.score == null ? "" : <b style={{ color: x.score >= t.passMark ? "var(--good)" : "var(--bad)" }}>{x.score}%</b>)],
          ["", (x) => t.mode === "ONLINE_LAB" && (x.state === "IN_PROGRESS" || x.state === "DISCONNECTED") ? (
            <div className="row">
              <button className="btn ghost sm" onClick={() => act({ action: "reset", userId: x.userId }, `Let ${x.name} start again? Their saved answers are deleted.`)}>Restart</button>
              <button className="btn ghost sm" onClick={() => act({ action: "submitOne", userId: x.userId }, `Submit ${x.name}'s test now with the saved answers?`)}>Submit now</button>
            </div>) : null],
        ]} />
      </div>

      <Card title={`Paper (${d.paper.length} questions)`} style={{ marginTop: 16 }}>
        <details><summary className="small">Show questions</summary>
          <ol className="small">{d.paper.map((q) => <li key={q.id}><span className="pill grey">{q.subject}</span> {q.text.slice(0, 160)}</li>)}</ol>
        </details>
        {t.status !== "LIVE" && d.rows.every((x) => x.state === "NOT_STARTED") && <button className="btn ghost sm" onClick={async () => { if (window.confirm("Delete this lab test?")) { await act({ action: "delete" }); r.push("/labtests"); } }}>Delete test</button>}
      </Card>
    </Page>
  );
}

function OfflinePanel({ t, onChange, setMsg }: { t: D["test"]; onChange: () => void; setMsg: (m: string) => void }) {
  const [pass, setPass] = useState("");
  const [res, setRes] = useState<{ imported: number; skipped: { roll: string; reason: string }[] } | null>(null);
  return (
    <div className="grid g2" style={{ marginBottom: 16 }}>
      <Card title="1. Before the test: download the package">
        <ol className="small" style={{ marginTop: 0 }}>
          <li>Choose a passphrase. Keep it to yourself until exam day. It is not saved anywhere.</li>
          <li>Download the package and copy it to the lab server PC on a USB drive.</li>
          <li>On the lab server PC, run <b>start-lab-server</b> from the NSCT Lab Server folder, open it in a browser and load the package with the passphrase.</li>
          <li>Switch off the internet. Students open the address the lab server shows, for example <code>http://192.168.1.10:8080</code>.</li>
        </ol>
        <form className="row" onSubmit={async (e) => {
          e.preventDefault();
          const r = await fetch(`/api/labtests/${t.id}/package`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passphrase: pass }) });
          if (!r.ok) { setMsg((await r.json().catch(() => ({}))).error ?? "Could not build the package."); return; }
          const a = document.createElement("a"); a.href = URL.createObjectURL(await r.blob()); a.download = `${t.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.nsctlab`; a.click();
          setPass(""); onChange();
        }}>
          <input type="password" required minLength={8} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Passphrase, 8 or more characters" style={{ maxWidth: 260 }} autoComplete="new-password" />
          <button className="btn" type="submit">Download package</button>
        </form>
        {t.packagedAt && <p className="tiny muted">Last downloaded {fmtDateTime(t.packagedAt)}. Each download contains the current student list.</p>}
        <p className="tiny muted">Get the lab server from the project files: the <code>lab-server</code> folder. It needs Node.js 18 or newer on the lab server PC.</p>
      </Card>
      <Card title="2. After the test: upload the results">
        <p className="small" style={{ marginTop: 0 }}>On the lab server, press <b>End exam</b>, then <b>Export results</b>. Bring the results file here when you are back online. The file is signed, so any edit after the test is rejected, and the portal marks every answer again itself.</p>
        <form className="row" onSubmit={async (e) => {
          e.preventDefault();
          try { setRes(await upload(`/api/labtests/${t.id}/results`, new FormData(e.currentTarget))); onChange(); } catch (er) { setMsg((er as Error).message); }
        }}>
          <input type="file" name="file" accept=".json,.nsctresults" required />
          <button className="btn" type="submit">Upload results</button>
        </form>
        {t.resultsImportedAt && <p className="tiny muted">Results imported {fmtDateTime(t.resultsImportedAt)}.</p>}
        {res && <div className="notice info" style={{ marginTop: 8 }}>Imported {res.imported} students.{res.skipped.length ? ` Skipped: ${res.skipped.map((x) => `${x.roll} (${x.reason})`).join(", ")}` : ""}</div>}
      </Card>
    </div>
  );
}
