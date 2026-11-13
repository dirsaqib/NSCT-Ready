export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAnyRole, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";

/**
 * Search students who opted in to the talent pool. Only verified employers can search.
 * Contact details are never shown: employers message candidates through the platform.
 */
export const GET = handle(async (req: Request) => {
  const u = await requireAnyRole(["EMPLOYER", "ADMIN"]);
  if (u.role === "EMPLOYER") {
    const e = await prisma.employer.findUnique({ where: { id: u.employerId ?? "-" } });
    if (!e?.verified) throw new HttpError(403, "Your organisation is waiting for verification by the platform team.");
  }
  const f = z.object({
    skill: z.enum(["PS", "PROG", "DSA", "DB", "SE", "WEB", "AI", "NET", "OS", "SEC"]).optional(),
    minSkill: z.coerce.number().int().min(0).max(100).default(60),
    minScore: z.coerce.number().int().min(0).max(100).default(0),
    program: z.string().optional(), universityId: z.string().optional(), city: z.string().optional(),
  }).parse(Object.fromEntries(new URL(req.url).searchParams));

  const profiles = await prisma.profile.findMany({
    where: {
      talentPool: true, user: { status: { in: ["VERIFIED", "ACTIVE"] } }, bestMock: { gte: f.minScore },
      ...(f.program ? { program: f.program } : {}), ...(f.universityId ? { universityId: f.universityId } : {}),
      ...(f.city ? { OR: [{ city: f.city }, { campus: { city: f.city } }] } : {}),
    },
    orderBy: { readiness: "desc" }, take: 300,
    select: { userId: true, fullName: true, program: true, semester: true, city: true, readiness: true, bestMock: true, university: { select: { name: true } }, campus: { select: { city: true } }, user: { select: { mastery: true, certificates: { where: { revoked: false }, select: { code: true, score: true, issuedAt: true } } } } },
  });
  const rows = profiles.map((p) => {
    const skills = Object.fromEntries(p.user.mastery.filter((m) => m.total >= 5).map((m) => [m.subject, Math.round((100 * m.correct) / m.total)]));
    return { id: p.userId, name: p.fullName, university: p.university.name, program: p.program, semester: p.semester, city: p.campus?.city || p.city, readiness: p.readiness, bestMock: p.bestMock, skills, certificates: p.user.certificates };
  }).filter((r) => !f.skill || (r.skills[f.skill] ?? 0) >= f.minSkill);
  await audit(u.id, "employer.search", u.employerId, f);
  return { candidates: rows.slice(0, 100) };
});
