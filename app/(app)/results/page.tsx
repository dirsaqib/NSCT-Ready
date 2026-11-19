"use client";
import CoachCard from "@/components/CoachCard";
import { Page, Card, Stat, useApi, Loading } from "@/components/ui";
import Radar from "@/components/Radar";
import { ColChart } from "@/components/Charts";

type C = {
  radar: { key: string; name: string; me: number | null; university: number | null; national: number | null }[];
  readiness: { me: number; university: number; national: number };
  readinessPercentile: number | null;
  progress: { date: string; score: number; type: string; percentile: number | null }[];
};

/** Score and percentile, domain radar, comparison with university and national averages, progress over time. */
export default function Results() {
  const { data, error } = useApi<C>("/api/me/compare");
  if (!data) return <Loading error={error} />;
  const r = data.readiness;
  return (
    <Page title="My results" sub="How you compare and how you are improving.">
      <CoachCard compact />
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat k="My readiness" v={r.me} d="out of 100" />
        <Stat k="My university average" v={r.university} />
        <Stat k="National average" v={r.national} />
        <Stat k="National percentile" v={data.readinessPercentile ?? "n/a"} d={data.readinessPercentile != null ? `ahead of ${data.readinessPercentile}% of active students` : "take a test first"} />
      </div>
      <div className="grid g2" style={{ marginBottom: 16 }}>
        <Card title="Performance by domain">
          <Radar labels={data.radar.map((x) => x.name)} series={[
            { name: "Me", values: data.radar.map((x) => x.me), color: "#0B6E4F" },
            { name: "My university", values: data.radar.map((x) => x.university), color: "#E9A23B", dash: "4 3" },
            { name: "National", values: data.radar.map((x) => x.national), color: "#5E6B64", dash: "2 3" },
          ]} />
          <div className="legend"><span><i style={{ background: "#0B6E4F" }} />Me</span><span><i style={{ background: "#E9A23B" }} />My university</span><span><i style={{ background: "#5E6B64" }} />National</span></div>
        </Card>
        <Card title="Domain table">
          <table><tbody>
            <tr><th>Domain</th><th>Me</th><th>University</th><th>National</th></tr>
            {data.radar.map((x) => <tr key={x.key}><td>{x.name}</td><td><b>{x.me ?? "n/a"}{x.me != null && "%"}</b></td><td>{x.university ?? "n/a"}{x.university != null && "%"}</td><td>{x.national ?? "n/a"}{x.national != null && "%"}</td></tr>)}
          </tbody></table>
        </Card>
      </div>
      <Card title="Progress over time">
        {data.progress.length ? <ColChart values={data.progress.map((p) => p.score)} labels={data.progress.map((p) => new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }))} suffix="%" /> : <div className="empty">Your timed tests will appear here.</div>}
      </Card>
      <History />
    </Page>
  );
}

const KIND: Record<string, string> = { PRACTICE: "Preparation level", MINI_MOCK: "Boss round", MOCK: "Mock test", DIAGNOSTIC: "Diagnostic", NATIONAL_MOCK: "National mock", LAB_TEST: "Lab test", MISTAKES: "Mistakes review" };

/** Every test the student finished, newest first, each opening its answers and explanations. */
function History() {
  const { data } = useApi<{ summary: { prepSessions: number; mocks: number; minutes: number; videos: number }; attempts: { id: string; type: string; label: string | null; score: number; submittedAt: string; minutes: number }[] }>("/api/me/activity");
  if (!data) return null;
  return (
    <Card title="My test history" style={{ marginTop: 16 }}>
      <p className="small muted" style={{ marginTop: 0 }}>{data.summary.prepSessions} preparation sessions, {data.summary.mocks} mock tests, {Math.floor(data.summary.minutes / 60)}h {data.summary.minutes % 60}m on tests, {data.summary.videos} videos opened. Your focal person sees this record too.</p>
      {data.attempts.length === 0 ? <div className="empty">Nothing yet. Start with level 1 in Preparation or Mock 1.</div> : (
        <table><tbody>
          <tr><th>When</th><th>Activity</th><th>Score</th><th>Time</th><th></th></tr>
          {data.attempts.map((a) => (
            <tr key={a.id}>
              <td className="tiny">{new Date(a.submittedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
              <td className="small">{KIND[a.type] ?? a.type}{a.label ? `: ${a.label}` : ""}</td>
              <td><b>{a.score}%</b></td>
              <td className="tiny">{a.minutes} min</td>
              <td><a className="small" href={`/test/${a.id}`}>Review</a></td>
            </tr>
          ))}
        </tbody></table>
      )}
    </Card>
  );
}
