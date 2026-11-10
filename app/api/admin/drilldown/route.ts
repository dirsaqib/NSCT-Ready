import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";

/**
 * Drill down: national > province > university > campus > department > students.
 * ?level=national | province&name= | university&id= | campus&id= | department&id=
 */
export const GET = handle(async (req: Request) => {
  await requireRole("ADMIN");
  const q = z.object({ level: z.enum(["national", "province", "university", "campus", "department"]).default("national"), id: z.string().optional(), name: z.string().optional() }).parse(Object.fromEntries(new URL(req.url).searchParams));
  const where =
    q.level === "province" ? { university: { province: q.name } } :
    q.level === "university" ? { universityId: q.id } :
    q.level === "campus" ? { campusId: q.id } :
    q.level === "department" ? { departmentId: q.id } : {};
  const profiles = await prisma.profile.findMany({
    where,
    select: { userId: true, fullName: true, rollNumber: true, program: true, readiness: true, bestMock: true, universityId: true, campusId: true, departmentId: true, university: { select: { name: true, province: true } }, campus: { select: { name: true } }, department: { select: { name: true } } },
  });
  const active = new Set((await prisma.attempt.groupBy({ by: ["userId"], where: { userId: { in: profiles.map((p) => p.userId) }, submittedAt: { not: null } } })).map((a) => a.userId));
  const roll = <K extends string>(key: (p: (typeof profiles)[number]) => [K, string] | null) => {
    const m = new Map<K, { id: K; name: string; n: number; act: number; sum: number }>();
    profiles.forEach((p) => { const k = key(p); if (!k) return; const z = m.get(k[0]) ?? { id: k[0], name: k[1], n: 0, act: 0, sum: 0 }; z.n++; if (active.has(p.userId)) { z.act++; z.sum += p.readiness; } m.set(k[0], z); });
    return [...m.values()].map((z) => ({ id: z.id, name: z.name, registered: z.n, active: z.act, avgReadiness: z.act ? Math.round(z.sum / z.act) : null })).sort((a, b) => (b.avgReadiness ?? -1) - (a.avgReadiness ?? -1));
  };
  const children =
    q.level === "national" ? { next: "province", rows: roll((p) => (p.university.province ? [p.university.province, p.university.province] : null)) } :
    q.level === "province" ? { next: "university", rows: roll((p) => [p.universityId, p.university.name]) } :
    q.level === "university" ? { next: "campus", rows: roll((p) => (p.campusId ? [p.campusId, p.campus!.name] : null)) } :
    q.level === "campus" ? { next: "department", rows: roll((p) => (p.departmentId ? [p.departmentId, p.department!.name] : null)) } :
    { next: "student", rows: profiles.map((p) => ({ id: p.userId, name: `${p.fullName} (${p.rollNumber})`, registered: 1, active: active.has(p.userId) ? 1 : 0, avgReadiness: active.has(p.userId) ? p.readiness : null })) };
  const act = profiles.filter((p) => active.has(p.userId));
  return { level: q.level, registered: profiles.length, active: act.length, avgReadiness: act.length ? Math.round(act.reduce((s, p) => s + p.readiness, 0) / act.length) : null, ...children };
});
