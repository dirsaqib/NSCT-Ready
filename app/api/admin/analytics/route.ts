import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import { SUBJECTS } from "@/lib/syllabus";
import { pkDay } from "@/lib/scoring";

/** Super admin analytics: everything on the platform in one response. */
export const GET = handle(async () => {
  await requireRole("ADMIN");
  const DAY = 86400000;
  const since30 = new Date(Date.now() - 30 * DAY);

  const [profiles, users, attempts30, attemptsAll, typeStats, mastery, topics, roles, aiToday, aiAll, qCounts, reports, flagged, verifiers, authors, revenue, tickets, surveys] = await Promise.all([
    prisma.profile.findMany({ select: { userId: true, program: true, semester: true, city: true, gender: true, readiness: true, streakDays: true, leaderboard: true, talentPool: true, consentResearch: true, createdAt: true, verifiedAt: true, verifiedById: true, university: { select: { name: true, province: true, sector: true } } } }),
    prisma.user.groupBy({ by: ["status"], where: { role: "STUDENT" }, _count: true }),
    prisma.attempt.findMany({ where: { submittedAt: { gte: since30 } }, select: { submittedAt: true } }),
    prisma.attempt.groupBy({ by: ["userId", "type"], where: { submittedAt: { not: null } }, _count: true }),
    prisma.attempt.groupBy({ by: ["type"], where: { submittedAt: { not: null } }, _count: true, _avg: { score: true, tabSwitches: true } }),
    prisma.mastery.groupBy({ by: ["subject"], _sum: { correct: true, total: true } }),
    prisma.topicMastery.groupBy({ by: ["subject", "topic"], _sum: { correct: true, total: true } }),
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.aiUsage.aggregate({ where: { day: pkDay() }, _sum: { calls: true } }),
    prisma.aiUsage.aggregate({ _sum: { calls: true } }),
    prisma.question.groupBy({ by: ["status"], _count: true }),
    prisma.questionReport.count({ where: { resolved: false } }),
    prisma.attempt.findMany({ where: { NOT: { flags: { isEmpty: true } } }, orderBy: { submittedAt: "desc" }, take: 50, select: { id: true, type: true, score: true, tabSwitches: true, fullscreenExits: true, flags: true, submittedAt: true, startedAt: true, user: { select: { id: true, profile: { select: { fullName: true, university: { select: { name: true } } } } } } } }),
    prisma.user.findMany({ where: { role: { in: ["FOCAL", "CAMPUS_ADMIN"] } }, select: { id: true, role: true, email: true, lastSeenAt: true, university: { select: { name: true } } } }),
    prisma.question.groupBy({ by: ["authorId", "status"], where: { authorId: { not: null } }, _count: true }),
    prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amountPkr: true }, _count: true }),
    prisma.ticket.groupBy({ by: ["status"], _count: true }),
    prisma.survey.count({ where: { active: true } }),
  ]);

  const tests = new Map<string, { total: number; diag: number; mocks: number; practice: number }>();
  for (const a of attemptsAll) {
    const z = tests.get(a.userId) ?? { total: 0, diag: 0, mocks: 0, practice: 0 };
    z.total += a._count;
    if (a.type === "DIAGNOSTIC") z.diag += a._count;
    if (a.type === "MOCK" || a.type === "NATIONAL_MOCK") z.mocks += a._count;
    if (a.type === "PRACTICE") z.practice += a._count;
    tests.set(a.userId, z);
  }
  const active = profiles.filter((p) => tests.has(p.userId));
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const days = [...Array(30)].map((_, i) => day(new Date(Date.now() - (29 - i) * DAY)));
  const count = (list: Date[]) => days.map((d) => list.filter((x) => day(x) === d).length);
  const hours = Array(24).fill(0);
  attempts30.forEach((a) => a.submittedAt && hours[(a.submittedAt.getUTCHours() + 5) % 24]++);

  const group = (key: (p: (typeof profiles)[number]) => string | null | undefined) => {
    const m = new Map<string, { n: number; act: number; sum: number; mocks: number }>();
    for (const p of profiles) {
      const k = key(p) || "Not given";
      const z = m.get(k) ?? { n: 0, act: 0, sum: 0, mocks: 0 };
      z.n++;
      const t = tests.get(p.userId);
      if (t) { z.act++; z.sum += p.readiness; z.mocks += t.mocks; }
      m.set(k, z);
    }
    return [...m.entries()].map(([k, z]) => ({ group: k, registered: z.n, active: z.act, avgReadiness: z.act ? Math.round(z.sum / z.act) : null, mocks: z.mocks })).sort((a, b) => b.registered - a.registered);
  };
  const bins = Array(10).fill(0);
  active.forEach((p) => bins[Math.min(9, Math.floor(p.readiness / 10))]++);
  const t = topics.filter((x) => (x._sum.total ?? 0) >= 10).map((x) => ({ subject: x.subject, topic: x.topic, accuracy: Math.round((100 * (x._sum.correct ?? 0)) / (x._sum.total || 1)) }));
  const statusN = (s: string) => users.find((x) => x.status === s)?._count ?? 0;
  const verified = profiles.filter((p) => p.verifiedAt);

  // Focal person activity: verifications done, average hours to verify, questions contributed.
  const focal = verifiers.map((v) => {
    const mine = profiles.filter((p) => p.verifiedById === v.id && p.verifiedAt);
    const hrs = mine.length ? Math.round(mine.reduce((s, p) => s + (p.verifiedAt!.getTime() - p.createdAt.getTime()) / 3600000, 0) / mine.length) : null;
    const q = authors.filter((a) => a.authorId === v.id);
    return { id: v.id, email: v.email, role: v.role, university: v.university?.name, lastSeenAt: v.lastSeenAt, verified: mine.length, avgHoursToVerify: hrs, questions: q.reduce((s, x) => s + x._count, 0), questionsLive: q.filter((x) => x.status === "LIVE").reduce((s, x) => s + x._count, 0) };
  });

  return {
    kpis: {
      registered: profiles.length, active: active.length, universities: new Set(profiles.map((p) => p.university.name)).size,
      tests: attemptsAll.reduce((s, a) => s + a._count, 0),
      avgReadiness: active.length ? Math.round(active.reduce((s, p) => s + p.readiness, 0) / active.length) : 0,
      aiCallsToday: aiToday._sum.calls ?? 0, aiCallsTotal: aiAll._sum.calls ?? 0, openQuestionReports: reports,
      pendingVerification: statusN("PENDING"), blocked: statusN("BLOCKED"),
      revenuePkr: revenue._sum.amountPkr ?? 0, paidPayments: revenue._count,
      openTickets: tickets.find((x) => x.status === "OPEN")?._count ?? 0, activeSurveys: surveys,
    },
    series: { days, registrations: count(profiles.map((p) => p.createdAt)), verifications: count(verified.map((p) => p.verifiedAt!)), tests: count(attempts30.map((a) => a.submittedAt!)), hours },
    funnel: [
      { step: "Registered", n: profiles.length },
      { step: "Verified", n: verified.length },
      { step: "Practising", n: [...tests.values()].filter((z) => z.practice > 0 || z.diag > 0).length },
      { step: "Took a mock test", n: [...tests.values()].filter((z) => z.mocks >= 1).length },
      { step: "Took 3+ mocks", n: [...tests.values()].filter((z) => z.mocks >= 3).length },
    ],
    readinessBins: bins,
    testTypes: typeStats.map((x) => ({ type: x.type, taken: x._count, avgScore: Math.round(x._avg.score ?? 0), avgTabSwitches: Number((x._avg.tabSwitches ?? 0).toFixed(1)) })),
    subjects: SUBJECTS.map((s) => { const m = mastery.find((x) => x.subject === s.key); return { key: s.key, name: s.name, weight: s.weight, accuracy: m?._sum.total ? Math.round((100 * (m._sum.correct ?? 0)) / m._sum.total) : null }; }),
    weakestTopics: t.slice().sort((a, b) => a.accuracy - b.accuracy).slice(0, 10),
    strongestTopics: t.slice().sort((a, b) => b.accuracy - a.accuracy).slice(0, 10),
    byUniversity: group((p) => p.university.name), byProvince: group((p) => p.university.province), bySector: group((p) => p.university.sector),
    byProgram: group((p) => p.program), bySemester: group((p) => `Semester ${p.semester}`), byCity: group((p) => p.city), byGender: group((p) => p.gender),
    consent: { research: profiles.filter((p) => p.consentResearch).length, leaderboard: profiles.filter((p) => p.leaderboard).length, talentPool: profiles.filter((p) => p.talentPool).length },
    roles: roles.map((r) => ({ role: r.role, n: r._count })),
    questionBank: qCounts.map((q) => ({ status: q.status, n: q._count })),
    cheating: flagged.map((a) => ({ id: a.id, userId: a.user.id, student: a.user.profile?.fullName ?? "Unknown", university: a.user.profile?.university.name, type: a.type, score: a.score, minutes: a.submittedAt ? Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 60000) : null, tabSwitches: a.tabSwitches, fullscreenExits: a.fullscreenExits, flags: a.flags, at: a.submittedAt })),
    focal,
  };
});
