// Anonymised national snapshot for HEC and government. Consenting students only, no names,
// and no group smaller than minGroup is ever included.
import { prisma } from "./db";
import { SUBJECTS } from "./syllabus";

export async function buildSnapshot(minGroup: number) {
  const consented = await prisma.profile.findMany({
    where: { consentResearch: true },
    select: { userId: true, program: true, semester: true, readiness: true, bestMock: true, university: { select: { name: true, province: true } } },
  });
  const ids = consented.map((p) => p.userId);
  const activeIds = new Set(
    (await prisma.attempt.groupBy({ by: ["userId"], where: { userId: { in: ids }, submittedAt: { not: null } } })).map((a) => a.userId),
  );
  const active = consented.filter((p) => activeIds.has(p.userId));

  const [subj, topics, mocks] = await Promise.all([
    prisma.mastery.groupBy({ by: ["subject"], where: { userId: { in: [...activeIds] } }, _sum: { correct: true, total: true }, _count: true }),
    prisma.topicMastery.groupBy({ by: ["subject", "topic"], where: { userId: { in: [...activeIds] } }, _sum: { correct: true, total: true }, _count: true }),
    prisma.attempt.aggregate({ where: { userId: { in: [...activeIds] }, type: { in: ["MOCK", "NATIONAL_MOCK"] }, submittedAt: { not: null } }, _count: true, _avg: { score: true } }),
  ]);

  let hiddenGroups = 0;
  const group = (key: (p: (typeof consented)[number]) => string | null | undefined) => {
    const m = new Map<string, { n: number; act: number; sum: number }>();
    for (const p of consented) {
      const k = key(p) || "Not given";
      const z = m.get(k) ?? { n: 0, act: 0, sum: 0 };
      z.n++;
      if (activeIds.has(p.userId)) { z.act++; z.sum += p.readiness; }
      m.set(k, z);
    }
    return [...m.entries()]
      .filter(([, z]) => (z.n >= minGroup ? true : (hiddenGroups++, false)))
      .map(([k, z]) => ({ group: k, students: z.n, active: z.act, avgReadiness: z.act ? Math.round(z.sum / z.act) : null }))
      .sort((a, b) => (b.avgReadiness ?? 0) - (a.avgReadiness ?? 0));
  };

  const bins = Array(10).fill(0);
  active.forEach((p) => bins[Math.min(9, Math.floor(p.readiness / 10))]++);
  const ok = active.length >= minGroup;
  const t = topics
    .filter((x) => x._count >= minGroup)
    .map((x) => ({ subject: x.subject, topic: x.topic, accuracy: Math.round((100 * (x._sum.correct ?? 0)) / (x._sum.total || 1)) }))
    .sort((a, b) => a.accuracy - b.accuracy);

  return {
    generatedAt: new Date().toISOString(),
    minGroup,
    students: consented.length,
    active: active.length,
    universities: new Set(consented.map((p) => p.university.name)).size,
    avgReadiness: active.length ? Math.round(active.reduce((s, p) => s + p.readiness, 0) / active.length) : null,
    mocks: mocks._count,
    avgMockScore: mocks._avg.score == null ? null : Math.round(mocks._avg.score),
    subjects: SUBJECTS.map((s) => {
      const r = subj.find((x) => x.subject === s.key);
      return { subject: s.name, weight: s.weight, accuracy: r && r._count >= minGroup && r._sum.total ? Math.round((100 * (r._sum.correct ?? 0)) / r._sum.total) : null };
    }),
    weakestTopics: t.slice(0, 15),
    strongestTopics: t.slice().reverse().slice(0, 6),
    readinessBins: ok ? bins : null,
    bands: ok
      ? {
          top: active.filter((p) => p.readiness >= 75).length,
          qualify: active.filter((p) => p.readiness >= 60 && p.readiness < 75).length,
          borderline: active.filter((p) => p.readiness >= 45 && p.readiness < 60).length,
          risk: active.filter((p) => p.readiness < 45).length,
        }
      : null,
    byProvince: group((p) => p.university.province),
    byProgram: group((p) => p.program),
    bySemester: group((p) => `Semester ${p.semester}`),
    byUniversity: group((p) => p.university.name),
    hiddenGroups,
  };
}

export type Snapshot = Awaited<ReturnType<typeof buildSnapshot>>;
