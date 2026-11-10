"use client";
import { api, SUBJECT_SHORT } from "@/components/api";
import { Page, useApi, Loading } from "@/components/ui";

type Q = { id: string; type: string; subject: string; topic: string; text: string; code: string | null; options: string[]; answers: number[]; explanation: string };

export default function Bookmarks() {
  const { data, error, reload } = useApi<{ bookmarks: Q[] }>("/api/bookmarks");
  if (!data) return <Loading error={error} />;
  return (
    <Page title="Saved questions" sub="Questions you saved during practice and tests.">
      <div className="card qlist">
        {data.bookmarks.map((q) => (
          <div className="q" key={q.id}>
            <div className="row between"><div className="qmeta" style={{ margin: 0 }}><span className="pill grey">{SUBJECT_SHORT[q.subject]}</span><span className="pill grey">{q.topic}</span></div>
              <button className="btn ghost sm" onClick={async () => { await api("/api/bookmarks", { method: "DELETE", body: { questionId: q.id } }); reload(); }}>Remove</button></div>
            <b>{q.text}</b>{q.code && <pre className="code">{q.code}</pre>}
            {q.type !== "CODE" && <ol type="A" className="small">{q.options.map((o, i) => <li key={i} style={q.answers.includes(i) ? { color: "var(--good)", fontWeight: 700 } : {}}>{o}</li>)}</ol>}
            <div className="small muted">{q.explanation}</div>
          </div>
        ))}
        {!data.bookmarks.length && <div className="empty">No saved questions yet. Use Save question during practice.</div>}
      </div>
    </Page>
  );
}
