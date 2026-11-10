"use client";
import Link from "next/link";
import { useState } from "react";
import { SUBJECT_SHORT } from "@/components/api";
import { Page, Card, Stat, useApi, Loading, Table, Tabs, Pill, fmtDate, fmtDateTime, lakh } from "@/components/ui";
import { ColChart, HBars, pct } from "@/components/Charts";

type Row = { group: string; registered: number; active: number; avgReadiness: number | null; mocks: number };
type A = {
  kpis: Record<string, number>;
  series: { days: string[]; registrations: number[]; verifications: number[]; tests: number[]; hours: number[] };
  funnel: { step: string; n: number }[]; readinessBins: number[];
  testTypes: { type: string; taken: number; avgScore: number; avgTabSwitches: number }[];
  subjects: { key: string; name: string; weight: number; accuracy: number | null }[];
  weakestTopics: { subject: string; topic: string; accuracy: number }[]; strongestTopics: { subject: string; topic: string; accuracy: number }[];
  byUniversity: Row[]; byProvince: Row[]; bySector: Row[]; byProgram: Row[]; bySemester: Row[]; byCity: Row[]; byGender: Row[];
  consent: { research: number; leaderboard: number; talentPool: number };
  roles: { role: string; n: number }[]; questionBank: { status: string; n: number }[];
  cheating: { id: string; userId: string; student: string; university?: string; type: string; score: number; minutes: number | null; tabSwitches: number; fullscreenExits: number; flags: string[]; at: string }[];
  focal: { id: string; email: string | null; role: string; university?: string; lastSeenAt: string | null; verified: number; avgHoursToVerify: number | null; questions: number; questionsLive: number }[];
};
type GKey = "byUniversity" | "byProvince" | "bySector" | "byProgram" | "bySemester" | "byCity" | "byGender";
const FLAG: Record<string, string> = { FAST_HIGH_SCORE: "Very fast, high score", TAB_SWITCHING: "Tab switching", FULLSCREEN_EXITS: "Left full screen", SHARED_DEVICE: "Shared device", SHARED_IP: "Shared network", ANSWER_PATTERN: "Matching answers" };

/** Super admin: every number on the platform. */
export default function Analytics() {
  const { data: a, error } = useApi<A>("/api/admin/analytics");
  const [by, setBy] = useState<GKey>("byUniversity");
  const [series, setSeries] = useState<"registrations" | "verifications" | "tests">("registrations");
  if (!a) return <Loading error={error} />;
  const k = a.kpis;
  return (
    <Page title="Platform analytics" sub="Everything, live. Drill into any number from Drill down." actions={<><Link className="btn sec" href="/admin/live">Live now</Link><Link className="btn" href="/admin/drilldown">Drill down</Link></>}>
      <div className="grid g4" style={{ marginBottom: 12 }}>
        <Stat k="Registered" v={k.registered.toLocaleString()} d={`${k.pendingVerification} pending, ${k.blocked} blocked`} />
        <Stat k="Active" v={k.active.toLocaleString()} d={`${pct(k.active, k.registered)}% of registered`} />
        <Stat k="Tests taken" v={k.tests.toLocaleString()} d={`${k.universities} universities`} />
        <Stat k="Avg readiness" v={k.avgReadiness} d="active students" />
        <Stat k="Revenue" v={lakh(k.revenuePkr)} d={`${k.paidPayments} payments`} />
        <Stat k="AI tutor calls" v={k.aiCallsToday} d={`today, ${k.aiCallsTotal.toLocaleString()} total`} />
        <Stat k="Open tickets" v={<Link href="/admin/support">{k.openTickets}</Link>} d={`${k.openQuestionReports} question reports`} />
        <Stat k="Integrity flags" v={a.cheating.length} d="latest 50 flagged tests" />
      </div>
      <div className="grid g2" style={{ marginBottom: 16 }}>
        <Card title="Last 30 days" right={<Tabs value={series} onChange={setSeries} tabs={[["registrations", "Registrations"], ["verifications", "Verifications"], ["tests", "Tests"]]} />}>
          <ColChart values={a.series[series]} labels={a.series.days.map((d) => d.slice(5))} />
        </Card>
        <Card title="Funnel">
          <HBars rows={a.funnel.map((f) => ({ label: f.step, v: f.n, text: `${f.n.toLocaleString()} (${pct(f.n, a.funnel[0].n)}%)` }))} />
        </Card>
        <Card title="When students study (Pakistan time)"><ColChart values={a.series.hours} labels={a.series.hours.map((_, i) => `${i}:00`)} every={3} /></Card>
        <Card title="Readiness distribution (active)"><ColChart values={a.readinessBins} labels={a.readinessBins.map((_, i) => `${i * 10}-${i * 10 + 9}`)} every={1} /></Card>
        <Card title="Subject accuracy"><HBars grade max={100} rows={a.subjects.map((s) => ({ label: s.name, sub: `${s.weight}%`, v: s.accuracy ?? 0, text: s.accuracy == null ? "n/a" : `${s.accuracy}%` }))} /></Card>
        <Card title="Test types">
          <Table rows={a.testTypes} cols={[["Type", (t) => t.type.replace("_", " ").toLowerCase()], ["Taken", (t) => t.taken.toLocaleString()], ["Avg score", (t) => `${t.avgScore}%`], ["Avg tab switches", (t) => t.avgTabSwitches]]} />
          <h3>Question bank</h3><div className="row">{a.questionBank.map((q) => <Pill key={q.status} tone="grey">{q.status.toLowerCase().replace("_", " ")}: {q.n}</Pill>)}</div>
          <h3>Users by role</h3><div className="row">{a.roles.map((r) => <Pill key={r.role} tone="grey">{r.role.toLowerCase()}: {r.n}</Pill>)}</div>
        </Card>
      </div>
      <Card style={{ marginBottom: 16 }}>
        <Tabs value={by} onChange={setBy} tabs={[["byUniversity", "University"], ["byProvince", "Province"], ["bySector", "Sector"], ["byProgram", "Program"], ["bySemester", "Semester"], ["byCity", "City"], ["byGender", "Gender"]]} />
        <Table rows={a[by]} cols={[["Group", (r) => r.group], ["Registered", (r) => r.registered], ["Active", (r) => `${r.active} (${pct(r.active, r.registered)}%)`], ["Mocks", (r) => r.mocks], ["Avg readiness", (r) => <b>{r.avgReadiness ?? "n/a"}</b>]]} />
      </Card>
      <div className="grid g2" style={{ marginBottom: 16 }}>
        <Card title="Weakest topics"><Table rows={a.weakestTopics} cols={[["Topic", (t) => <><Pill tone="grey">{SUBJECT_SHORT[t.subject]}</Pill> {t.topic}</>], ["Accuracy", (t) => <b>{t.accuracy}%</b>]]} /></Card>
        <Card title="Strongest topics"><Table rows={a.strongestTopics} cols={[["Topic", (t) => <><Pill tone="grey">{SUBJECT_SHORT[t.subject]}</Pill> {t.topic}</>], ["Accuracy", (t) => <b>{t.accuracy}%</b>]]} /></Card>
      </div>
      <Card title="Integrity review" style={{ marginBottom: 16 }}>
        <Table rows={a.cheating} empty="No flagged tests." cols={[
          ["Student", (c) => <><b>{c.student}</b><div className="tiny muted">{c.university}</div></>], ["Test", (c) => c.type.toLowerCase().replace("_", " ")], ["Score", (c) => `${c.score}%`], ["Minutes", (c) => c.minutes ?? ""],
          ["Signals", (c) => <div className="row">{c.flags.map((f) => <Pill key={f} tone="bad">{FLAG[f] ?? f}</Pill>)}</div>], ["When", (c) => fmtDateTime(c.at)],
        ]} />
        <p className="tiny muted">Flags are signals for review, not proof. Flagged tests do not receive certificates.</p>
      </Card>
      <div className="grid g2">
        <Card title="Focal person activity">
          <Table rows={a.focal} cols={[["Person", (f) => <><b>{f.email}</b><div className="tiny muted">{f.university} · {f.role.toLowerCase()}</div></>], ["Verified", (f) => f.verified], ["Avg hours to verify", (f) => f.avgHoursToVerify ?? "n/a"], ["Questions", (f) => `${f.questionsLive} live of ${f.questions}`], ["Last seen", (f) => fmtDate(f.lastSeenAt)]]} />
        </Card>
        <Card title="Consent">
          <HBars rows={[["Research and HEC data", a.consent.research], ["Public leaderboard", a.consent.leaderboard], ["Talent pool for employers", a.consent.talentPool]].map(([l, n]) => ({ label: String(l), v: Number(n), text: `${n} (${pct(Number(n), k.registered)}%)` }))} max={k.registered} />
          <p className="small muted">Only research-consenting students appear in HEC data. Only talent pool students are visible to employers.</p>
        </Card>
      </div>
    </Page>
  );
}
