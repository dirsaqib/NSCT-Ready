"use client";
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
    </Page>
  );
}
