"use client";
import Link from "next/link";
import StartButton from "@/components/StartButton";
import { Page, useApi, Loading, fmtDate } from "@/components/ui";
import { BLUEPRINTS, SUBJECTS } from "@/lib/syllabus";

type M = { n: number; unlocked: boolean; attempts: number; best: number | null; last: { id: string; score: number; submittedAt: string } | null };
type G = { key: string; name: string; weight: number; acc: number; gain: number; topics: string[] };
type Data = { mocks: M[]; latest: { attemptId: string; label: string; score: number; subjects: G[]; study: G[]; skip: G[] } | null; uniQuestions: number };

const LEVEL = ["", "Foundation", "Standard", "Challenge"];
const tone = (p: number) => (p >= 90 ? "var(--brand)" : p >= 70 ? "#B7791F" : "var(--bad, #C2453A)");

/** Mock 1, 2 and 3: full NSCT papers that get harder, with clear guidance on what to study after each. */
export default function Mocks() {
  const { data, error } = useApi<Data>("/api/me/mocks");
  const total = Object.values(BLUEPRINTS.MOCK).reduce((a, b) => a + (b ?? 0), 0);
  if (!data) return <Page title="Mock tests"><Loading error={error} /></Page>;
  return (
    <Page title="Mock tests" sub={`Three full NSCT papers, ${total} questions in 60 minutes, weighted like the real test. Finish one to open the next. Target: 90% or more.`}>
      <div className="big3">
        {data.mocks.map((m) => (
          <div key={m.n} className="card" style={{ opacity: m.unlocked ? 1 : 0.6 }}>
            <div className="row between"><h2 style={{ margin: 0 }}>Mock {m.n}</h2><span className="pill">{LEVEL[m.n]}</span></div>
            {m.best == null
              ? <p className="small muted" style={{ margin: "4px 0 10px" }}>{m.unlocked ? "Not taken yet." : `Opens after you finish Mock ${m.n - 1}.`}</p>
              : <p className="small" style={{ margin: "4px 0 10px" }}>Best <b style={{ color: tone(m.best) }}>{m.best}%</b> · {m.attempts} attempt{m.attempts > 1 ? "s" : ""}{m.last ? ` · last ${fmtDate(m.last.submittedAt)}` : ""}</p>}
            {m.unlocked && <StartButton type="MOCK" mockNo={m.n} label={m.best == null ? `Start Mock ${m.n}` : "Take it again"} className={m.best == null ? "btn" : "btn sec"} confirmText={`Mock ${m.n}: 60 minutes, timed. Find a quiet place. Start now?`} />}
            {m.last && <Link className="small" style={{ marginTop: 8 }} href={`/test/${m.last.id}`}>See answers and explanations</Link>}
          </div>
        ))}
      </div>

      {data.latest ? (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--brand)" }}>
          <div className="row between">
            <div><span className="tiny muted">Guidance from your {data.latest.label}</span><h2 style={{ margin: "2px 0" }}>{data.latest.score >= 90 ? "Excellent. Keep this level." : `You scored ${data.latest.score}%. Here is how to reach 90%.`}</h2></div>
            <Link className="btn sec sm" href="/prepare">Go to preparation</Link>
          </div>
          <div className="grid g2" style={{ marginTop: 10 }}>
            <div>
              <h3 style={{ marginBottom: 6 }}>Study these first</h3>
              {data.latest.study.length === 0 ? <p className="small muted">Nothing below 90%. Revise lightly and take the next mock.</p> : data.latest.study.slice(0, 5).map((s) => (
                <div key={s.key} style={{ borderTop: "1px solid var(--line)", padding: "8px 0" }}>
                  <div className="row between"><b className="small">{s.name}</b><span className="small" style={{ color: tone(s.acc) }}>{s.acc}%</span></div>
                  <div className="tiny muted">Worth {s.weight}% of the test{s.gain ? `, can add about ${s.gain} marks` : ""}.{s.topics.length ? ` Revise: ${s.topics.join(", ")}.` : ""}</div>
                  <div className="row" style={{ marginTop: 4 }}><Link className="tiny" href={`/learn?subject=${s.key}`}>Watch and read</Link><Link className="tiny" href="/prepare">Practise levels</Link></div>
                </div>
              ))}
            </div>
            <div>
              <h3 style={{ marginBottom: 6 }}>Already strong, light revision only</h3>
              {data.latest.skip.length === 0 ? <p className="small muted">No subject at 90% yet. Keep going.</p> : data.latest.skip.map((s) => (
                <div key={s.key} className="row between" style={{ borderTop: "1px solid var(--line)", padding: "8px 0" }}><span className="small">{s.name}</span><span className="small" style={{ color: tone(s.acc) }}>{s.acc}%</span></div>
              ))}
              <p className="tiny muted" style={{ marginTop: 10 }}>Spend about 80% of your time on the list on the left, starting from the top. It is ordered by how many marks each subject can still add.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 16 }}><h3 style={{ marginTop: 0 }}>Guidance appears here after your first mock</h3><p className="small muted" style={{ margin: 0 }}>You will see exactly which subjects and topics to study, and which you can revise lightly.</p></div>
      )}

      {data.uniQuestions > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row between">
            <div><h2 style={{ margin: 0 }}>University test</h2><p className="small muted" style={{ margin: "4px 0 0" }}>{data.uniQuestions} questions set by your own university.</p></div>
            <StartButton type="PRACTICE" universityOnly count={20} label="Start university test" className="btn sec" />
          </div>
        </div>
      )}

      <div className="card flat">
        <h3 style={{ marginTop: 0 }}>What each mock covers</h3>
        <table><tbody>
          <tr><th>Subject</th><th>Weight</th><th>Questions</th></tr>
          {SUBJECTS.map((s) => <tr key={s.key}><td>{s.name}</td><td>{s.weight}%</td><td>{BLUEPRINTS.MOCK[s.key]}</td></tr>)}
        </tbody></table>
      </div>
    </Page>
  );
}
