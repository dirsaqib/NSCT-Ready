export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { prisma } from "@/lib/db";
import { requireRole, profileScope } from "@/lib/auth";
import { handle } from "@/lib/http";
import { linkUnassigned } from "@/lib/register";
import { SUBJECTS } from "@/lib/syllabus";

const DAY = 86400000;
const pct = (c: number, t: number) => (t ? Math.round((100 * c) / t) : null);
const name = (k: string) => SUBJECTS.find((s) => s.key === k)?.short ?? k;

/**
 * Detailed readiness insights for HODs, campus admins, focal persons and chairs.
 * Everything is limited to the caller's own scope (department, campus or university).
 * Optional filters: department, program, semester, section.
 */
export const GET = handle(async (req: Request) => {
  const u = await requireRole("HOD");
  const q = new URL(req.url).searchParams;
  const scope = profileScope(u, q.get("universityId"));
  if (scope.universityId) await linkUnassigned(scope.universityId).catch(() => 0);
  const where: Record<string, unknown> = { ...scope };
  if (q.get("department")) where.departmentId = scope.departmentId ?? q.get("department");
  if (q.get("program")) where.program = q.get("program");
  if (q.get("semester")) where.semester = q.get("semester");
  if (q.get("section")) where.section = q.get("section");

  const [profiles, filterRows] = await Promise.all([
    prisma.profile.findMany({
      where,
      select: { userId: true, fullName: true, rollNumber: true, program: true, semester: true, section: true, readiness: true, bestMock: true, streakDays: true, department: { select: { id: true, name: true } }, campus: { select: { name: true } }, user: { select: { status: true, lastSeenAt: true } } },
    }),
    prisma.profile.findMany({ where: scope, select: { program: true, semester: true, section: true, department: { select: { id: true, name: true } } } }),
  ]);
  const ids = profiles.map((p) => p.userId);
  const since8w = new Date(Date.now() - 56 * DAY);

  const [mastery, topicRows, natSubj, natTopic, attempts, mockBest, natReady] = await Promise.all([
    prisma.mastery.findMany({ where: { userId: { in: ids } }, select: { userId: true, subject: true, correct: true, total: true } }),
    prisma.topicMastery.groupBy({ by: ["subject", "topic"], where: { userId: { in: ids } }, _sum: { correct: true, total: true }, _count: true }),
    prisma.mastery.groupBy({ by: ["subject"], _sum: { correct: true, total: true } }),
    prisma.topicMastery.groupBy({ by: ["subject", "topic"], _sum: { correct: true, total: true } }),
    prisma.attempt.findMany({ where: { userId: { in: ids }, submittedAt: { not: null, gte: since8w } }, select: { userId: true, type: true, score: true, submittedAt: true, flags: true } }),
    prisma.attempt.groupBy({ by: ["label", "userId"], where: { userId: { in: ids }, type: "MOCK", label: { in: ["Mock 1", "Mock 2", "Mock 3"] }, submittedAt: { not: null } }, _max: { score: true } }),
    prisma.profile.aggregate({ where: { readiness: { gt: 0 } }, _avg: { readiness: true } }),
  ]);

  // Per student: subject accuracy, activity and risk reasons.
  const byUser = new Map<string, Record<string, number | null>>();
  for (const m of mastery) {
    const r = byUser.get(m.userId) ?? {};
    r[m.subject] = m.total >= 5 ? pct(m.correct, m.total) : null;
    byUser.set(m.userId, r);
  }
  const lastTest = new Map<string, Date>();
  const mockCount = new Map<string, number>();
  const flagged = new Map<string, number>();
  for (const a of attempts) {
    if (a.submittedAt && (!lastTest.get(a.userId) || a.submittedAt > lastTest.get(a.userId)!)) lastTest.set(a.userId, a.submittedAt);
    if (a.type === "MOCK" || a.type === "NATIONAL_MOCK") mockCount.set(a.userId, (mockCount.get(a.userId) ?? 0) + 1);
    if (a.flags?.length) flagged.set(a.userId, (flagged.get(a.userId) ?? 0) + 1);
  }
  const mocksDone = new Map<string, number>();
  for (const m of mockBest) mocksDone.set(m.userId, (mocksDone.get(m.userId) ?? 0) + 1);

  const now = Date.now();
  const students = profiles.map((p) => {
    const subj = byUser.get(p.userId) ?? {};
    const scored = Object.entries(subj).filter(([, v]) => v != null) as [string, number][];
    const weakest = scored.sort((a, b) => a[1] - b[1])[0];
    const seen = p.user.lastSeenAt ? new Date(p.user.lastSeenAt).getTime() : 0;
    const daysIdle = seen ? Math.floor((now - seen) / DAY) : null;
    const reasons: string[] = [];
    const started = scored.length > 0 || p.readiness > 0;
    if (!started) reasons.push("Not started");
    else {
      if (p.readiness < 45) reasons.push(`Low readiness (${p.readiness})`);
      if (daysIdle != null && daysIdle >= 7) reasons.push(`Inactive ${daysIdle} days`);
      if (!mocksDone.get(p.userId)) reasons.push("No mock taken");
      if (weakest && weakest[1] < 40) reasons.push(`${name(weakest[0])} at ${weakest[1]}%`);
    }
    return {
      userId: p.userId, fullName: p.fullName, rollNumber: p.rollNumber, program: p.program, semester: p.semester, section: p.section,
      department: p.department?.name ?? null, campus: p.campus?.name ?? null, status: p.user.status,
      readiness: p.readiness, bestMock: p.bestMock, mocksDone: mocksDone.get(p.userId) ?? 0, streak: p.streakDays,
      lastActive: p.user.lastSeenAt, daysIdle, weakSubject: weakest ? name(weakest[0]) : null, weakScore: weakest ? weakest[1] : null,
      subjects: subj, reasons, started,
    };
  });
  const started = students.filter((s) => s.started);
  const avg = (xs: typeof students) => { const a = xs.filter((s) => s.started); return a.length ? Math.round(a.reduce((t, x) => t + x.readiness, 0) / a.length) : null; };

  // Subjects against the national picture, ranked by how many marks the gap costs.
  const subjects = SUBJECTS.map((s) => {
    const rows = mastery.filter((m) => m.subject === s.key);
    const c = rows.reduce((t, r) => t + r.correct, 0), tot = rows.reduce((t, r) => t + r.total, 0);
    const n = natSubj.find((x) => x.subject === s.key);
    const ours = pct(c, tot), nat = pct(n?._sum.correct ?? 0, n?._sum.total ?? 0);
    const gap = ours != null && nat != null ? ours - nat : null;
    return { key: s.key, name: s.name, short: s.short, weight: s.weight, accuracy: ours, national: nat, gap, answers: tot, impact: ours != null ? Math.round(((100 - ours) * s.weight) / 100) : null };
  });

  const natTopicMap = new Map(natTopic.map((t) => [`${t.subject}|${t.topic}`, pct(t._sum.correct ?? 0, t._sum.total ?? 0)]));
  const topics = topicRows.filter((t) => (t._sum.total ?? 0) >= 10).map((t) => ({
    subject: t.subject, subjectName: name(t.subject), topic: t.topic, students: t._count, answers: t._sum.total ?? 0,
    accuracy: pct(t._sum.correct ?? 0, t._sum.total ?? 0) ?? 0, national: natTopicMap.get(`${t.subject}|${t.topic}`) ?? null,
  })).sort((a, b) => a.accuracy - b.accuracy);

  // Readiness spread.
  const buckets = [[0, 30], [30, 45], [45, 60], [60, 70], [70, 80], [80, 101]].map(([lo, hi]) => ({ label: hi > 100 ? "80+" : `${lo}-${hi}`, count: started.filter((s) => s.readiness >= lo && s.readiness < hi).length }));

  // Weekly trend: active students and average mock score.
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = now - (7 - i) * 7 * DAY, start = end - 7 * DAY;
    const inWeek = attempts.filter((a) => a.submittedAt && a.submittedAt.getTime() >= start && a.submittedAt.getTime() < end);
    const mocks = inWeek.filter((a) => a.type === "MOCK" || a.type === "NATIONAL_MOCK");
    return { label: new Date(end - DAY).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), active: new Set(inWeek.map((a) => a.userId)).size, tests: inWeek.length, mockAvg: mocks.length ? Math.round(mocks.reduce((t, a) => t + a.score, 0) / mocks.length) : null };
  });

  // Group comparison with the weakest subject of each group.
  const group = (key: (s: (typeof students)[number]) => string | null) => {
    const m = new Map<string, typeof students>();
    students.forEach((s) => { const k = key(s) || "Not given"; m.set(k, [...(m.get(k) ?? []), s]); });
    return [...m.entries()].map(([g, xs]) => {
      const sums: Record<string, [number, number]> = {};
      xs.forEach((x) => Object.entries(x.subjects).forEach(([k, v]) => { if (v != null) { sums[k] = sums[k] ?? [0, 0]; sums[k][0] += v; sums[k][1]++; } }));
      const weak = Object.entries(sums).map(([k, [t, n]]) => [k, Math.round(t / n)] as [string, number]).sort((a, b) => a[1] - b[1])[0];
      return { group: g, registered: xs.length, started: xs.filter((x) => x.started).length, readiness: avg(xs), ready: xs.filter((x) => x.readiness >= 70).length, atRisk: xs.filter((x) => x.started && x.readiness < 45).length, weakSubject: weak ? `${name(weak[0])} ${weak[1]}%` : null };
    }).sort((a, b) => b.registered - a.registered);
  };

  const mockProgress = [1, 2, 3].map((n) => {
    const rows = mockBest.filter((f) => f.label === `Mock ${n}`);
    return { n, students: rows.length, avgBest: rows.length ? Math.round(rows.reduce((t, r) => t + (r._max.score ?? 0), 0) / rows.length) : null };
  });

  const avgReadiness = avg(students);
  const nationalReadiness = Math.round(natReady._avg.readiness ?? 0);

  // Plain-language advice the HOD or focal person can act on this week.
  const advice: { level: "high" | "medium" | "good"; title: string; detail: string }[] = [];
  const lagging = subjects.filter((s) => s.gap != null && s.gap <= -5).sort((a, b) => (a.gap! * a.weight) - (b.gap! * b.weight));
  for (const s of lagging.slice(0, 3)) {
    const t = topics.filter((x) => x.subject === s.key).slice(0, 3).map((x) => x.topic);
    advice.push({ level: s.weight >= 20 || s.gap! <= -10 ? "high" : "medium", title: `${s.short} is ${Math.abs(s.gap!)} points below the national average`, detail: `It carries ${s.weight}% of NSCT marks.${t.length ? ` Weakest topics: ${t.join(", ")}.` : ""} Arrange a focused class or lab session and ask students to clear these Preparation levels this week.` });
  }
  const weakest = subjects.filter((s) => s.accuracy != null).sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0))[0];
  if (weakest && !lagging.includes(weakest)) advice.push({ level: "medium", title: `Biggest marks opportunity: ${weakest.short}`, detail: `Accuracy is ${weakest.accuracy}% on a subject worth ${weakest.weight}% of the test. Improving it gains the most marks.` });
  const notStarted = students.filter((s) => !s.started).length;
  if (students.length && notStarted / students.length >= 0.15) advice.push({ level: "high", title: `${notStarted} students have not started yet`, detail: `That is ${Math.round((100 * notStarted) / students.length)}% of registered students. Share their login details again and set a class deadline for Mock 1.` });
  const idle = started.filter((s) => (s.daysIdle ?? 0) >= 7).length;
  if (idle >= 5) advice.push({ level: "medium", title: `${idle} students inactive for a week or more`, detail: "A short reminder in class or on the class WhatsApp group usually brings most of them back." });
  const [m1, m2] = mockProgress;
  if (m1.students >= 10 && m2.students < m1.students * 0.5) advice.push({ level: "medium", title: "Few students have moved on to Mock 2", detail: `${m1.students} took Mock 1 but only ${m2.students} took Mock 2. Schedule Mock 2 in a lab slot so students keep moving.` });
  const sections = group((s) => (s.section ? `${s.program} ${s.semester}${s.section}` : null)).filter((g) => g.readiness != null && g.started >= 5);
  const depAvg = avgReadiness ?? 0;
  for (const g of sections.filter((g) => (g.readiness ?? 0) <= depAvg - 8).slice(0, 2)) advice.push({ level: "medium", title: `Section ${g.group} is behind`, detail: `Readiness ${g.readiness} against ${depAvg} overall.${g.weakSubject ? ` Weakest: ${g.weakSubject}.` : ""} Speak to the section's teachers.` });
  const flaggedCount = [...flagged.values()].reduce((a, b) => a + b, 0);
  if (flaggedCount >= 5) advice.push({ level: "medium", title: `${flaggedCount} tests were auto-submitted or flagged`, detail: "Students left the test window during mock tests. Remind them of the exam rules before the real test." });
  if (avgReadiness != null && avgReadiness >= nationalReadiness + 5) advice.push({ level: "good", title: "Ahead of the national average", detail: `Readiness ${avgReadiness} against ${nationalReadiness} nationally. Keep the momentum with Mock 3 for everyone.` });
  if (!advice.length) advice.push({ level: "good", title: "No urgent issues", detail: "Keep students practising weekly. More advice appears here as students take tests." });

  const filters = {
    departments: scope.departmentId ? [] : [...new Map(filterRows.filter((r) => r.department).map((r) => [r.department!.id, r.department!.name])).entries()].map(([id, n]) => ({ id, name: n })),
    programs: [...new Set(filterRows.map((r) => r.program).filter(Boolean))].sort(),
    semesters: [...new Set(filterRows.map((r) => r.semester).filter(Boolean))].sort(),
    sections: [...new Set(filterRows.map((r) => r.section).filter(Boolean) as string[])].sort(),
  };

  return {
    scope: scope.departmentId ? "department" : scope.campusId ? "campus" : "university", filters,
    kpi: {
      registered: students.length, started: started.length, notStarted, avgReadiness, nationalReadiness,
      ready: started.filter((s) => s.readiness >= 70).length, atRisk: started.filter((s) => s.readiness < 45).length,
      active7: students.filter((s) => s.daysIdle != null && s.daysIdle < 7).length, flagged: flaggedCount,
    },
    advice, subjects, topics: topics.slice(0, 25), buckets, weeks, mockProgress,
    byDepartment: scope.departmentId ? [] : group((s) => s.department),
    byProgram: group((s) => s.program), bySemester: group((s) => s.semester), bySection: sections,
    attention: students.filter((s) => s.reasons.length).sort((a, b) => b.reasons.length - a.reasons.length || a.readiness - b.readiness).slice(0, 300),
    top: started.slice().sort((a, b) => b.readiness - a.readiness).slice(0, 10),
    students,
  };
});
