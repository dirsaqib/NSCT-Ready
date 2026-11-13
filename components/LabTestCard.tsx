"use client";
import Link from "next/link";
import { useState } from "react";
import { useApi, fmtDateTime } from "./ui";
import StartButton from "./StartButton";

type L = { id: string; title: string; mode: "ONLINE_LAB" | "OFFLINE_LAN"; status: string; opensAt: string; closesAt: string; durationMin: number; attemptId: string | null; submitted: boolean };

/** Department lab tests the student is listed for. Shown only when there is one. */
export default function LabTestCard() {
  const { data } = useApi<{ tests: L[] }>("/api/labtests/available");
  const [code, setCode] = useState<Record<string, string>>({});
  const [seat, setSeat] = useState<Record<string, string>>({});
  if (!data?.tests.length) return null;
  return (
    <div className="card" style={{ marginBottom: 16, borderColor: "var(--accent)" }}>
      <h2 style={{ marginTop: 0 }}>Lab test from your department</h2>
      {data.tests.map((t) => (
        <div key={t.id} className="q">
          <div className="row between"><b>{t.title}</b><span className="small muted">{fmtDateTime(t.opensAt)} · {t.durationMin} minutes</span></div>
          {t.submitted ? <p className="small">Submitted. Your department will release the result.</p>
            : t.attemptId ? <p className="small">You have started this test. <Link href={`/test/${t.attemptId}`}>Continue</Link></p>
            : t.mode === "OFFLINE_LAN" ? <p className="small">This test runs offline in your lab. Your invigilator will give you the lab server address on the day.</p>
            : t.status !== "LIVE" ? <p className="small">Not started yet. Go to your lab at the scheduled time. The invigilator will show an access code.</p>
            : (
              <div className="row" style={{ marginTop: 8 }}>
                <input type="text" placeholder="Access code" value={code[t.id] ?? ""} onChange={(e) => setCode({ ...code, [t.id]: e.target.value.toUpperCase().trim() })} style={{ maxWidth: 160, fontFamily: "var(--font-mono)", letterSpacing: 2 }} />
                <input type="text" placeholder="Seat or PC number" value={seat[t.id] ?? ""} onChange={(e) => setSeat({ ...seat, [t.id]: e.target.value })} style={{ maxWidth: 160 }} />
                {(code[t.id] ?? "").length >= 6 && <StartButton type="LAB_TEST" labTestId={t.id} accessCode={code[t.id]} seat={seat[t.id]} label="Start lab test" className="btn acc" confirmText="Start the lab test now? The timer starts at once and you get one attempt." />}
              </div>
            )}
        </div>
      ))}
    </div>
  );
}
