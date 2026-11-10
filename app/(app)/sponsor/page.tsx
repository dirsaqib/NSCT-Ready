"use client";
import { Page, Card, Stat, useApi, Loading, Table, fmtDate, download } from "@/components/ui";
import { ColChart, pct } from "@/components/Charts";

type D = {
  sponsor: { name: string; logoUrl: string | null; contractStart: string | null; contractEnd: string | null } | null;
  seats: number; usedSeats: number; universities: { id: string; name: string; students: number }[]; activeStudents: number; testsTaken: number; avgReadiness: number;
  improvement: { students: number; avgScoreGain: number | null }; certificatesBranded: number; monthlyTests: { month: string; tests: number }[];
  events: { id: string; title: string; date: string; venue: string | null }[];
};

/** Sponsor: reach and impact of their sponsorship. Aggregates only. */
export default function Sponsor() {
  const { data: d, error } = useApi<D>("/api/sponsor/dashboard");
  if (!d) return <Loading error={error} />;
  if (!d.sponsor) return <Page title="Sponsor portal"><div className="notice">Your login is not linked to a sponsor yet. Contact the platform team.</div></Page>;
  return (
    <Page title={`${d.sponsor.name}: impact`} sub={`Contract ${fmtDate(d.sponsor.contractStart)} to ${fmtDate(d.sponsor.contractEnd)}`}
      actions={<button className="btn" onClick={() => download("/api/reports/sponsor", "sponsor-impact.pdf")}>Impact report (PDF)</button>}>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat k="Seats used" v={`${d.usedSeats} of ${d.seats}`} d={`${pct(d.usedSeats, d.seats)}% used`} />
        <Stat k="Active students" v={d.activeStudents} d={`${d.testsTaken} tests taken`} />
        <Stat k="Average score gain" v={d.improvement.avgScoreGain == null ? "n/a" : `${d.improvement.avgScoreGain > 0 ? "+" : ""}${d.improvement.avgScoreGain} points`} d={`first test to latest, ${d.improvement.students} students`} />
        <Stat k="Branded certificates" v={d.certificatesBranded} d={`average readiness ${d.avgReadiness}`} />
      </div>
      <div className="grid g2">
        <Card title="Tests per month"><ColChart values={d.monthlyTests.map((m) => m.tests)} labels={d.monthlyTests.map((m) => m.month)} every={1} /></Card>
        <Card title="Universities reached"><Table rows={d.universities} cols={[["University", (u) => u.name], ["Students", (u) => u.students]]} /></Card>
        <Card title="Events and awards"><Table rows={d.events} empty="No events yet." cols={[["Event", (e) => <b>{e.title}</b>], ["Date", (e) => fmtDate(e.date)], ["Venue", (e) => e.venue]]} /></Card>
      </div>
    </Page>
  );
}
