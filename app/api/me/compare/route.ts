import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { SUBJECTS } from "@/lib/syllabus";

/** Student results page: radar by subject vs university and national averages, progress over time, percentile. */
export const GET = handle(async () => {
  const u = await requireUser();
  const p = await prisma.profile.findUnique({ where: { userId: u.id }, select: { universityId: true, readiness: true } });
  const [mine, uniIds, attempts] = await Promise.all([
    prisma.mastery.findMany({ where: { userId: u.id } }),
    prisma.profile.findMany({ where: { universityId: p?.universityId ?? "-" }, select: { userId: true } }),
    prisma.attempt.findMany({ where: { userId: u.id, submittedAt: { not: null }, type: { in: ["DIAGNOSTIC", "MOCK", "NATIONAL_MOCK", "MINI_MOCK"] } }, orderBy: { submittedAt: "asc" }, select: { submittedAt: true, score: true, type: true, percentile: true } }),
  ]);
  const [uni, nat, uniReady, natReady] = await Promise.all([
    prisma.mastery.groupBy({ by: ["subject"], where: { userId: { in: uniIds.map((x) => x.userId) } }, _sum: { correct: true, total: true } }),
    prisma.mastery.groupBy({ by: ["subject"], _sum: { correct: true, total: true } }),
    prisma.profile.aggregate({ where: { universityId: p?.universityId ?? "-", readiness: { gt: 0 } }, _avg: { readiness: true } }),
    prisma.profile.aggregate({ where: { readiness: { gt: 0 } }, _avg: { readiness: true } }),
  ]);
  const pct = (c?: number | null, t?: number | null) => (t ? Math.round((100 * (c ?? 0)) / t) : null);
  const higher = await prisma.profile.count({ where: { readiness: { gt: p?.readiness ?? 0 } } });
  const active = await prisma.profile.count({ where: { readiness: { gt: 0 } } });
  return {
    radar: SUBJECTS.map((s) => {
      const m = mine.find((x) => x.subject === s.key), a = uni.find((x) => x.subject === s.key), n = nat.find((x) => x.subject === s.key);
      return { key: s.key, name: s.short, me: pct(m?.correct, m?.total), university: pct(a?._sum.correct, a?._sum.total), national: pct(n?._sum.correct, n?._sum.total) };
    }),
    readiness: { me: p?.readiness ?? 0, university: Math.round(uniReady._avg.readiness ?? 0), national: Math.round(natReady._avg.readiness ?? 0) },
    readinessPercentile: active > 1 ? Math.round((100 * (active - 1 - higher)) / (active - 1)) : null,
    progress: attempts.map((a) => ({ date: a.submittedAt, score: a.score, type: a.type, percentile: a.percentile })),
  };
});
