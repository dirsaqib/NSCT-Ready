import { prisma } from "./db";

/** Reach and impact of one sponsor's sponsorships. Aggregates only, no individual student data. */
export async function sponsorImpact(sponsorId: string) {
  const sponsor = await prisma.sponsor.findUnique({ where: { id: sponsorId }, include: { sponsorships: true, events: true } });
  if (!sponsor) return { sponsor: null };
  const uniIds = sponsor.sponsorships.map((s) => s.universityId).filter(Boolean) as string[];
  const unis = await prisma.university.findMany({ where: { id: { in: uniIds } }, select: { id: true, name: true } });
  const profiles = await prisma.profile.findMany({ where: { universityId: { in: uniIds } }, select: { userId: true, universityId: true, readiness: true } });
  const ids = profiles.map((p) => p.userId);
  const attempts = await prisma.attempt.findMany({ where: { userId: { in: ids }, submittedAt: { not: null }, type: { in: ["DIAGNOSTIC", "MOCK", "NATIONAL_MOCK"] } }, orderBy: { submittedAt: "asc" }, select: { userId: true, score: true, submittedAt: true } });
  const first = new Map<string, number>(), last = new Map<string, number>();
  attempts.forEach((a) => { if (!first.has(a.userId)) first.set(a.userId, a.score); last.set(a.userId, a.score); });
  const improved = [...first.keys()].filter((k) => attempts.filter((a) => a.userId === k).length >= 2);
  const avgGain = improved.length ? Math.round(improved.reduce((s, k) => s + (last.get(k)! - first.get(k)!), 0) / improved.length) : null;
  const certs = await prisma.certificate.count({ where: { sponsorId: sponsor.id } });
  const months = [...Array(6)].map((_, i) => { const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); return d.toISOString().slice(0, 7); });
  return {
    sponsor: { id: sponsor.id, name: sponsor.name, logoUrl: sponsor.logoUrl, contractStart: sponsor.contractStart, contractEnd: sponsor.contractEnd },
    seats: sponsor.sponsorships.reduce((s, x) => s + x.seats, 0),
    usedSeats: profiles.length,
    universities: unis.map((x) => ({ ...x, students: profiles.filter((p) => p.universityId === x.id).length })),
    activeStudents: new Set(attempts.map((a) => a.userId)).size,
    testsTaken: attempts.length,
    avgReadiness: profiles.length ? Math.round(profiles.reduce((s, p) => s + p.readiness, 0) / profiles.length) : 0,
    improvement: { students: improved.length, avgScoreGain: avgGain },
    certificatesBranded: certs,
    monthlyTests: months.map((m) => ({ month: m, tests: attempts.filter((a) => a.submittedAt!.toISOString().startsWith(m)).length })),
    events: sponsor.events,
  };
}
