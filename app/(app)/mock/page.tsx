"use client";
import { useState } from "react";
import StartButton from "@/components/StartButton";
import { BLUEPRINTS, SUBJECTS } from "@/lib/syllabus";
import { useApi, fmtDateTime } from "@/components/ui";

type W = { id: string; name: string; opensAt: string; closesAt: string; open: boolean; taken: boolean };

export default function Mock() {
  const [sub, setSub] = useState("PS");
  const [code, setCode] = useState("");
  const { data } = useApi<{ windows: W[] }>("/api/windows");
  const w = data?.windows[0];
  return (
    <>
      <div className="top"><div><h1>Mock tests</h1><p className="sub">Full-length, timed and weighted exactly like the NSCT syllabus.</p></div></div>
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>Full mock</h2>
          <p className="muted">60 questions in 60 minutes. Shuffled every time. Tab switches are recorded.</p>
          <StartButton type="MOCK" label="Start full mock" confirmText="Start the 60 minute mock now?" />
        </div>
        <div className="card">
          <h2>National mock</h2>
          <p className="muted">Same paper for everyone in a fixed window. One attempt, national ranking and percentile.</p>
          {!w ? <p className="small">No national mock scheduled yet. You will be notified.</p>
            : w.taken ? <p className="small">You have taken <b>{w.name}</b>. Results are under My results.</p>
            : w.open ? <><p className="small"><b>{w.name}</b> is open until {fmtDateTime(w.closesAt)}.</p><StartButton type="NATIONAL_MOCK" label="Start the national mock" className="btn acc" confirmText="You get one attempt. Start now?" /></>
            : <p className="small"><b>{w.name}</b> opens {fmtDateTime(w.opensAt)}.</p>}
        </div>
        <div className="card">
          <h2>Subject mini mock</h2>
          <p className="muted">15 minutes on one subject.</p>
          <select value={sub} onChange={(e) => setSub(e.target.value)} style={{ marginBottom: 12 }}>
            {SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
          <StartButton type="MINI_MOCK" subject={sub} label="Start mini mock" className="btn sec" />
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Employer hiring test</h2>
        <p className="muted">Got an invite code from an employer? Enter it here. Your result is shared with that employer only.</p>
        <div className="row"><input type="text" value={code} onChange={(e) => setCode(e.target.value.trim().toUpperCase())} placeholder="HIRE-XXXX-XXXX" style={{ maxWidth: 240 }} />
          {code.length >= 6 && <StartButton type="EMPLOYER_ASSESSMENT" assessmentCode={code} label="Start test" confirmText="Start the employer test now?" />}</div>
      </div>
      <div className="card flat">
        <h2>Full mock blueprint</h2>
        <table><tbody>
          <tr><th>Subject</th><th>Weight</th><th>Questions</th></tr>
          {SUBJECTS.map((s) => <tr key={s.key}><td>{s.name}</td><td>{s.weight}%</td><td>{BLUEPRINTS.MOCK[s.key]}</td></tr>)}
        </tbody></table>
      </div>
    </>
  );
}
