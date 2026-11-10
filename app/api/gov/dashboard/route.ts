import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAnyRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import { getSetting } from "@/lib/settings";
import { SUBJECTS } from "@/lib/syllabus";
import { audit } from "@/lib/audit";

/**
 * Live anonymised national dashboard with filters: province, city, university, sector (public or
 * private), program and gender. Consenting students only. Any group, and the filtered population
 * itself, below the minimum group size is withheld.
 */
export const GET = handle(async (req: Request) => {
  const u = await requireAnyRole(["GOV", "ADMIN"]);
  const f = z.object({
    province: z.string().optional(), city: z.string().optional(), universityId: z.string().optional(),
    sector: z.enum(["Public", "Private"]).optional(), program: z.string().optional(), gender: z.string().optional(),
  }).parse(Object.fromEntries(new URL(req.url).searchParams));
  const minGroup = await getSetting<number>("reports.minGroup");
  const where = {
    consentResearch: true,
    ...(f.program ? { program: f.program } : {}),
    ...(f.gender ? { gender: f.gender } : {}),
    ...(f.universityId ? { universityId: f.universityId } : {}),
    university: { ...(f.province ? { province: f.province } : {}), ...(f.sector ? { sector: f.sector } : {}) },
    ...(f.city ? { OR: [{ city: f.city }, { campus: { city: f.city } }] } : {}),
  };
  const profiles = await prisma.profile.findMany({
    where,
    select: { userId: true, readiness: true, program: true, gender: true, university: { select: { id: true, name: true, province: true, sector: true } }, campus: { select: { city: true, district: true } }, city: true },
  });
  await audit(u.id, "gov.dashboard", null, f);
  if (profiles.length < minGroup) return { withheld: true, minGroup, students: profiles.length < 1 ? 0 : `fewer than ${minGroup}` };

  const ids = profiles.map((p) => p.userId);
  const activeIds = new Set((await prisma.attempt.groupBy({ by: ["userId"], where: { userId: { in: ids }, submittedAt: { not: null } } })).map((a) => a.userId));
  const [subj, topics, tests] = await Promise.all([
    prisma.mastery.groupBy({ by: ["subject"], where: { userId: { in: ids } }, _sum: { correct: true, total: true } }),
    prisma.topicMastery.groupBy({ by: ["subject", "topic"], where: { userId: { in: ids } }, _sum: { correct: true, total: true }, _count: true }),
    prisma.attempt.aggregate({ where: { userId: { in: ids }, submittedAt: { not: null } }, _count: true, _avg: { score: true } }),
  ]);
  const group = (key: (p: (typeof profiles)[number]) => string | null | undefined) => {
    const m = new Map<string, number[]>();
    let hidden = 0;
    profiles.forEach((p) => { const k = key(p) || "Not given"; const arr = m.get(k) ?? []; if (activeIds.has(p.userId)) arr.push(p.readiness); else arr.push(-1); m.set(k, arr); });
    const rows = [...m.entries()].filter(([, v]) => (v.length >= minGroup ? true : (hidden++, false))).map(([k, v]) => {
      const act = v.filter((x) => x >= 0);
      return { group: k, students: v.length, active: act.length, avgReadiness: act.length ? Math.round(act.reduce((a, b) => a + b, 0) / act.length) : null };
    }).sort((a, b) => (b.avgReadiness ?? 0) - (a.avgReadiness ?? 0));
    return { rows, hidden };
  };
  const act = profiles.filter((p) => activeIds.has(p.userId));
  return {
    withheld: false, minGroup, students: profiles.length, active: act.length,
    universities: new Set(profiles.map((p) => p.university.id)).size,
    tests: tests._count, avgScore: Math.round(tests._avg.score ?? 0),
    avgReadiness: act.length ? Math.round(act.reduce((s, p) => s + p.readiness, 0) / act.length) : null,
    subjects: SUBJECTS.map((s) => { const r = subj.find((x) => x.subject === s.key); return { key: s.key, name: s.name, weight: s.weight, accuracy: r?._sum.total ? Math.round((100 * (r._sum.correct ?? 0)) / r._sum.total) : null }; }),
    skillGaps: topics.filter((t) => t._count >= minGroup).map((t) => ({ subject: t.subject, topic: t.topic, accuracy: Math.round((100 * (t._sum.correct ?? 0)) / (t._sum.total || 1)) })).sort((a, b) => a.accuracy - b.accuracy).slice(0, 15),
    byProvince: group((p) => p.university.province),
    byDistrict: group((p) => p.campus?.district),
    byCity: group((p) => p.campus?.city || p.city),
    bySector: group((p) => p.university.sector),
    byUniversity: group((p) => p.university.name),
    byProgram: group((p) => p.program),
    byGender: group((p) => p.gender),
  };
});
