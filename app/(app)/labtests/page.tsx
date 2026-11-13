"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/api";
import { SUBJECTS } from "@/lib/syllabus";
import { Page, Card, useApi, Loading, Table, Pill, fmtDateTime } from "@/components/ui";

type T = { id: string; title: string; mode: "ONLINE_LAB" | "OFFLINE_LAN"; status: string; opensAt: string; closesAt: string; durationMin: number; questions: number; resultsReleased: boolean; _count: { attempts: number } };
type Dept = { id: string; name: string; programs: string[]; campus: { id: string; name: string } };
type Q = { id: string; subject: string; topic: string; type: string; difficulty: number; text: string };

const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** HODs, campus admins and focal persons schedule tests in their own computer labs. */
export default function LabTests() {
  const r = useRouter();
  const { data, error, reload } = useApi<{ tests: T[]; departments: Dept[] }>("/api/labtests");
  const [creating, setCreating] = useState(false);
  if (!data) return <Loading error={error} />;
  return (
    <Page title="Lab tests" sub="Run a test in your own computer lab, on the portal or completely offline."
      actions={<button className="btn" onClick={() => setCreating(!creating)}>{creating ? "Close" : "New lab test"}</button>}>
      {creating && <NewTest departments={data.departments} onDone={(id) => { reload(); r.push(`/labtests/${id}`); }} />}
      {!creating && (
        <div className="grid g2" style={{ marginBottom: 16 }}>
          <Card title="Online lab (CBT)">
            <p className="small" style={{ margin: 0 }}>Students sit at lab PCs and use the portal. Only your lab network can open the test, and only with the access code you show on the board. You watch every student live and close the test for everyone at once.</p>
          </Card>
          <Card title="Offline (internet off)">
            <p className="small" style={{ margin: 0 }}>Download an encrypted test file. One lab PC runs the NSCT Lab Server, and students open it over the lab network with the internet switched off. After the test, upload the signed results file here.</p>
          </Card>
        </div>
      )}
      <div className="card">
        <Table rows={data.tests} empty="No lab tests yet." onRow={(t) => r.push(`/labtests/${t.id}`)} cols={[
          ["Test", (t) => <Link href={`/labtests/${t.id}`}><b>{t.title}</b></Link>],
          ["Mode", (t) => <Pill tone="grey">{t.mode === "ONLINE_LAB" ? "Online lab" : "Offline LAN"}</Pill>],
          ["Opens", (t) => fmtDateTime(t.opensAt)],
          ["Questions", (t) => t.questions], ["Minutes", (t) => t.durationMin],
          ["Status", (t) => <Pill tone={t.status === "LIVE" ? "warn" : t.status === "CLOSED" ? "grey" : undefined}>{t.status.toLowerCase()}</Pill>],
          ["Taken", (t) => t._count.attempts],
          ["Results", (t) => (t.resultsReleased ? "Released" : t.status === "CLOSED" ? "Not released" : "")],
        ]} />
      </div>
    </Page>
  );
}

function NewTest({ departments, onDone }: { departments: Dept[]; onDone: (id: string) => void }) {
  const now = new Date();
  const [f, setF] = useState({
    title: "", mode: "ONLINE_LAB" as "ONLINE_LAB" | "OFFLINE_LAN", departmentId: departments.length === 1 ? departments[0].id : "",
    opensAt: local(new Date(now.getTime() + 86400000)), closesAt: local(new Date(now.getTime() + 86400000 + 3 * 3600000)),
    durationMin: 60, lateJoinMin: 15, negativeMarking: 0, passMark: 50, programs: "", sections: "", semesters: "", ip: "",
    paper: "draw" as "draw" | "pick", source: "DEPARTMENT" as "DEPARTMENT" | "NATIONAL" | "BOTH",
  });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const bank = useApi<{ questions: Q[] }>(f.paper === "pick" ? `/api/questions?view=department${f.departmentId ? `&departmentId=${f.departmentId}` : ""}&status=LIVE` : null, [f.paper, f.departmentId]);
  const dept = departments.find((d) => d.id === f.departmentId);
  const total = f.paper === "pick" ? picked.length : Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <form className="card" style={{ marginBottom: 16 }} onSubmit={async (e) => {
      e.preventDefault(); setMsg("");
      try {
        const r = await api<{ test: { id: string } }>("/api/labtests", { body: {
          title: f.title, mode: f.mode, departmentId: f.departmentId || null, durationMin: Number(f.durationMin), lateJoinMin: Number(f.lateJoinMin),
          opensAt: new Date(f.opensAt).toISOString(), closesAt: new Date(f.closesAt).toISOString(), negativeMarking: Number(f.negativeMarking), passMark: Number(f.passMark),
          programs: list(f.programs), sections: list(f.sections).map((s) => s.toUpperCase()), semesters: list(f.semesters), ipAllowlist: list(f.ip),
          ...(f.paper === "pick" ? { questionIds: picked } : { source: f.source, counts }),
        } });
        onDone(r.test.id);
      } catch (er) { setMsg((er as Error).message); }
    }}>
      <h2 style={{ marginTop: 0 }}>New lab test</h2>
      <div className="grid g2" style={{ marginBottom: 12 }}>
        {(["ONLINE_LAB", "OFFLINE_LAN"] as const).map((m) => (
          <label key={m} className="card flat" style={{ cursor: "pointer", borderColor: f.mode === m ? "var(--brand)" : undefined, borderWidth: f.mode === m ? 2 : 1 }}>
            <div className="row"><input type="radio" checked={f.mode === m} onChange={() => set({ mode: m })} /><b>{m === "ONLINE_LAB" ? "Online lab (CBT)" : "Offline, internet off"}</b></div>
            <div className="small muted">{m === "ONLINE_LAB" ? "Portal on lab PCs, locked to your lab network and an access code." : "Lab server on one PC, students connect over the lab network only."}</div>
          </label>
        ))}
      </div>
      <div className="grid g3">
        <label className="f">Title<input type="text" required value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="BSCS 7A NSCT pre-test" /></label>
        {departments.length > 1 && <label className="f">Department<select value={f.departmentId} onChange={(e) => set({ departmentId: e.target.value })}><option value="">Whole {departments.length ? "scope" : "university"}</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.campus.name} · {d.name}</option>)}</select></label>}
        <label className="f">Minutes<input type="number" min={5} max={300} value={f.durationMin} onChange={(e) => set({ durationMin: Number(e.target.value) })} /></label>
        <label className="f">Window opens<input type="datetime-local" required value={f.opensAt} onChange={(e) => set({ opensAt: e.target.value })} /></label>
        <label className="f">Window closes<input type="datetime-local" required value={f.closesAt} onChange={(e) => set({ closesAt: e.target.value })} /></label>
        <label className="f">No new starts after (minutes)<input type="number" min={0} max={120} value={f.lateJoinMin} onChange={(e) => set({ lateJoinMin: Number(e.target.value) })} /></label>
        <label className="f">Programs (comma separated, empty = all)<input type="text" value={f.programs} onChange={(e) => set({ programs: e.target.value })} placeholder={dept?.programs.join(", ") || "BS Computer Science"} /></label>
        <label className="f">Sections (empty = all)<input type="text" value={f.sections} onChange={(e) => set({ sections: e.target.value })} placeholder="A, B" /></label>
        <label className="f">Semesters (empty = all)<input type="text" value={f.semesters} onChange={(e) => set({ semesters: e.target.value })} placeholder="7, 8" /></label>
        <label className="f">Pass mark %<input type="number" min={0} max={100} value={f.passMark} onChange={(e) => set({ passMark: Number(e.target.value) })} /></label>
        <label className="f">Negative marking per wrong answer (0 to 1)<input type="number" step="0.05" min={0} max={1} value={f.negativeMarking} onChange={(e) => set({ negativeMarking: Number(e.target.value) })} /></label>
      </div>
      {f.mode === "ONLINE_LAB" && (
        <label className="f" style={{ marginTop: 12 }}>Lab network lock: public IP addresses or prefixes of your lab, comma separated. Empty = any network (not recommended).
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <input type="text" value={f.ip} onChange={(e) => set({ ip: e.target.value })} placeholder="203.0.113.10, 203.0.113.0/24" />
            <button type="button" className="btn sec sm" onClick={async () => { const r = await api<{ ip: string | null }>("/api/labtests/myip"); if (r.ip) set({ ip: list(f.ip).concat(r.ip).join(", ") }); }}>Add this PC&apos;s network</button>
          </div>
          <span className="tiny muted">Open this page on a lab PC and press the button to add the lab&apos;s address.</span>
        </label>
      )}
      <h3>Paper</h3>
      <div className="row" style={{ marginBottom: 8 }}>
        <label className="check" style={{ padding: 0 }}><input type="radio" checked={f.paper === "draw"} onChange={() => set({ paper: "draw" })} /><span>Draw at random per subject</span></label>
        <label className="check" style={{ padding: 0 }}><input type="radio" checked={f.paper === "pick"} onChange={() => set({ paper: "pick" })} /><span>Pick questions from our department bank</span></label>
      </div>
      {f.paper === "draw" ? (
        <>
          <label className="f" style={{ maxWidth: 360 }}>Draw from<select value={f.source} onChange={(e) => set({ source: e.target.value as typeof f.source })}><option value="DEPARTMENT">Our department bank</option><option value="NATIONAL">National NSCT bank</option><option value="BOTH">Both</option></select></label>
          <div className="grid g5" style={{ marginTop: 8 }}>{SUBJECTS.map((s) => <label key={s.key} className="f">{s.short}<input type="number" min={0} max={100} value={counts[s.key] ?? 0} onChange={(e) => setCounts({ ...counts, [s.key]: Number(e.target.value) })} /></label>)}</div>
        </>
      ) : !bank.data ? <Loading error={bank.error} /> : (
        <div style={{ maxHeight: 340, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}>
          {bank.data.questions.length === 0 && <div className="empty">The department bank is empty. Upload questions under Question bank first.</div>}
          {bank.data.questions.map((q) => (
            <label key={q.id} className="check" style={{ padding: "4px 0" }}>
              <input type="checkbox" checked={picked.includes(q.id)} onChange={() => setPicked(picked.includes(q.id) ? picked.filter((x) => x !== q.id) : [...picked, q.id])} />
              <span className="small"><Pill tone="grey">{q.subject}</Pill> {q.text.slice(0, 140)}</span>
            </label>
          ))}
        </div>
      )}
      {msg && <div className="notice bad" style={{ marginTop: 12 }}>{msg}</div>}
      <div className="row" style={{ marginTop: 16 }}><button className="btn" type="submit" disabled={!total}>Create test ({total} questions)</button></div>
    </form>
  );
}
