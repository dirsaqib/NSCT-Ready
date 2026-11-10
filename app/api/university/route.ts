import { prisma } from "@/lib/db";
import { requireRole, profileScope } from "@/lib/auth";
import { handle } from "@/lib/http";
import { SUBJECTS } from "@/lib/syllabus";

/**
 * Batch dashboard for HODs (own department), campus admins (own campus), focal persons and chairs
 * (own university). Platform admins may pass ?universityId=. Includes breakdowns by campus,
 * department, program and section, and an anonymised national comparison.
 */
export const GET = handle(async (req: Request) => {
  const u = await requireRole("HOD");
  const scope = profileScope(u, new URL(req.url).searchParams.get("universityId"));

  const profiles = await prisma.profile.findMany({
    where: scope,
    select: { userId: true, fullName: true, rollNumber: true, program: true, semester: true, section: true, readiness: true, bestMock: true, campus: { select: { name: true } }, department: { select: { name: true } }, user: { select: { status: true } } },
  });
  const ids = profiles.map((p) => p.userId);
  const [mastery, topics, attemptCounts, mocks] = await Promise.all([
    prisma.mastery.groupBy({ by: ["subject"], where: { userId: { in: ids } }, _sum: { correct: true, total: true } }),
    prisma.topicMastery.groupBy({ by: ["subject", "topic"], where: { userId: { in: ids } }, _sum: { correct: true, total: true } }),
    prisma.attempt.groupBy({ by: ["userId"], where: { userId: { in: ids }, submittedAt: { not: null } }, _count: true, _max: { submittedAt: true } }),
    prisma.attempt.aggregate({ where: { userId: { in: ids }, type: { in: ["MOCK", "NATIONAL_MOCK"] }, submittedAt: { not: null } }, _count: true, _avg: { score: true } }),
  ]);
  const act = new Map(attemptCounts.map((a) => [a.userId, a]));
  const students = profiles.map((p) => ({
    userId: p.userId, fullName: p.fullName, rollNumber: p.rollNumber, program: p.program, semester: p.semester, section: p.section,
    campus: p.campus?.name ?? null, department: p.department?.name ?? null, status: p.user.status, readiness: p.readiness, bestMock: p.bestMock,
    tests: act.get(p.userId)?._count ?? 0, lastActive: act.get(p.userId)?._max.submittedAt ?? null,
  }));
  const active = students.filter((s) => s.tests > 0);
  const avg = (xs: typeof students) => { const a = xs.filter((s) => s.tests > 0); return a.length ? Math.round(a.reduce((s, x) => s + x.readiness, 0) / a.length) : null; };
  const breakdown = (key: (s: (typeof students)[number]) => string | null) => {
    const m = new Map<string, typeof students>();
    students.forEach((s) => { const k = key(s) || "Not given"; m.set(k, [...(m.get(k) ?? []), s]); });
    return [...m.entries()].map(([k, xs]) => ({ group: k, registered: xs.length, active: xs.filter((x) => x.tests > 0).length, pending: xs.filter((x) => x.status === "PENDING").length, avgReadiness: avg(xs) })).sort((a, b) => b.registered - a.registered);
  };

  // National comparison without naming other universities.
  let national: { rank: number; of: number; nationalAvg: number } | null = null;
  if (scope.universityId) {
    const all = await prisma.profile.groupBy({ by: ["universityId"], where: { readiness: { gt: 0 } }, _avg: { readiness: true } });
    const sorted = all.sort((a, b) => (b._avg.readiness ?? 0) - (a._avg.readiness ?? 0));
    const i = sorted.findIndex((x) => x.universityId === scope.universityId);
    const nat = await prisma.profile.aggregate({ where: { readiness: { gt: 0 } }, _avg: { readiness: true } });
    if (i >= 0) national = { rank: i + 1, of: sorted.length, nationalAvg: Math.round(nat._avg.readiness ?? 0) };
  }

  return {
    scope,
    registered: students.length,
    pending: students.filter((s) => s.status === "PENDING").length,
    active: active.length,
    mocksTaken: mocks._count,
    avgMockScore: Math.round(mocks._avg.score ?? 0),
    avgReadiness: avg(students) ?? 0,
    national,
    subjects: SUBJECTS.map((s) => {
      const m = mastery.find((x) => x.subject === s.key);
      const t = m?._sum.total ?? 0;
      return { key: s.key, name: s.name, weight: s.weight, accuracy: t ? Math.round((100 * (m?._sum.correct ?? 0)) / t) : null };
    }),
    weakTopics: topics.filter((t) => (t._sum.total ?? 0) >= 10).map((t) => ({ subject: t.subject, topic: t.topic, answers: t._sum.total ?? 0, accuracy: Math.round((100 * (t._sum.correct ?? 0)) / (t._sum.total || 1)) })).sort((a, b) => a.accuracy - b.accuracy).slice(0, 10),
    byCampus: breakdown((s) => s.campus),
    byDepartment: breakdown((s) => s.department),
    byProgram: breakdown((s) => s.program),
    bySection: breakdown((s) => (s.section ? `${s.program} ${s.semester}${s.section}` : null)),
    atRisk: active.filter((s) => s.readiness < 45).sort((a, b) => a.readiness - b.readiness),
    notStarted: students.filter((s) => s.tests === 0),
    students,
  };
});
