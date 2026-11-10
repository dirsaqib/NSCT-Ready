"use client";
import StartButton from "@/components/StartButton";
import { SUBJECT_SHORT } from "@/components/api";
import { Page, useApi, Loading } from "@/components/ui";

type Q = { id: string; type: string; subject: string; topic: string; text: string; code: string | null; options: string[]; answers: number[]; explanation: string };

export default function Mistakes() {
  const { data, error } = useApi<{ mistakes: Q[] }>("/api/mistakes");
  if (!data) return <Loading error={error} />;
  const qs = data.mistakes;
  return (
    <Page title="Mistakes notebook" sub="Wrong answers come back here until you get them right." actions={qs.length > 0 && <StartButton type="MISTAKES" label={`Redo ${Math.min(20, qs.length)} mistakes`} />}>
      {qs.length ? (
        <div className="card qlist">
          {qs.map((q) => (
            <div className="q" key={q.id}>
              <div className="qmeta"><span className="pill grey">{SUBJECT_SHORT[q.subject]}</span><span className="pill grey">{q.topic}</span></div>
              <b>{q.text}</b>
              {q.code && <pre className="code">{q.code}</pre>}
              {q.type !== "CODE" && <div className="small">Correct answer: <b>{q.answers.map((a) => q.options[a]).join(", ")}</b></div>}
              <div className="small muted">{q.explanation}</div>
            </div>
          ))}
        </div>
      ) : <div className="card empty">No mistakes saved yet.</div>}
    </Page>
  );
}
