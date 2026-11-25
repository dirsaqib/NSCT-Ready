export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, profileScope } from "@/lib/auth";
import { handle } from "@/lib/http";
import { linkUnassigned } from "@/lib/register";

/** Students in the staff member's part of the hierarchy, with filters. */
export const GET = handle(async (req: Request) => {
  const u = await requireRole("HOD");
  const sp = new URL(req.url).searchParams;
  const f = z.object({
    status: z.enum(["PENDING", "VERIFIED", "ACTIVE", "BLOCKED"]).optional(),
    campusId: z.string().optional(), departmentId: z.string().optional(), program: z.string().optional(), section: z.string().optional(),
    q: z.string().optional(), universityId: z.string().optional(), page: z.coerce.number().int().min(0).default(0),
    sort: z.enum(["roll", "name", "new"]).default("roll"), mock: z.enum(["taken", "none"]).optional(),
  }).parse(Object.fromEntries([...sp.entries()].filter(([, v]) => v !== "")));
  const scope = profileScope(u, f.universityId);
  if (scope.universityId) await linkUnassigned(scope.universityId).catch(() => 0);
  const where = {
    ...scope,
    ...(f.campusId && !scope.campusId ? { campusId: f.campusId } : {}),
    ...(f.departmentId && !scope.departmentId ? { departmentId: f.departmentId } : {}),
    ...(f.program ? { program: f.program } : {}),
    ...(f.section ? { section: f.section } : {}),
    ...(f.status ? { user: { status: f.status } } : {}),
    ...(f.mock === "taken" ? { user: { ...(f.status ? { status: f.status } : {}), attempts: { some: { type: "MOCK" as const, submittedAt: { not: null } } } } } : {}),
    ...(f.mock === "none" ? { user: { ...(f.status ? { status: f.status } : {}), attempts: { none: { type: "MOCK" as const, submittedAt: { not: null } } } } } : {}),
    ...(f.q ? { OR: [{ fullName: { contains: f.q, mode: "insensitive" as const } }, { rollNumber: { contains: f.q, mode: "insensitive" as const } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.profile.count({ where }),
    prisma.profile.findMany({
      where, orderBy: f.sort === "new" ? [{ createdAt: "desc" as const }] : f.sort === "name" ? [{ fullName: "asc" as const }] : [{ rollNumber: "asc" as const }], skip: f.page * 200, take: 200,
      include: { user: { select: { id: true, email: true, phone: true, status: true, lastSeenAt: true, uploads: { where: { kind: "ENROLLMENT_PROOF" }, select: { id: true, filename: true } }, _count: { select: { attempts: true } } } }, campus: { select: { name: true } }, department: { select: { name: true } } },
    }),
  ]);
  // Best score in Mock 1, 2 and 3 for each student on this page.
  const best = await prisma.attempt.groupBy({ by: ["userId", "label"], where: { userId: { in: rows.map((r) => r.userId) }, type: "MOCK", submittedAt: { not: null }, label: { in: ["Mock 1", "Mock 2", "Mock 3"] } }, _max: { score: true }, _count: true });
  const mocks = (id: string) => Object.fromEntries(best.filter((b) => b.userId === id).map((b) => [b.label!, { best: Math.round(b._max.score ?? 0), tries: b._count }]));

  // Totals for the whole scope (not just this page): all students, by department, and who took a mock.
  const [all, byDept, took] = await Promise.all([
    prisma.profile.count({ where: scope }),
    prisma.profile.groupBy({ by: ["departmentId"], where: scope, _count: true }),
    prisma.profile.groupBy({ by: ["departmentId"], where: { ...scope, user: { attempts: { some: { type: "MOCK", submittedAt: { not: null } } } } }, _count: true }),
  ]);
  const names = await prisma.department.findMany({ where: { id: { in: byDept.map((d) => d.departmentId).filter(Boolean) as string[] } }, select: { id: true, name: true } });
  const departments = byDept.map((d) => ({ id: d.departmentId, name: names.find((n) => n.id === d.departmentId)?.name ?? "No department yet", students: d._count, tookMock: took.find((t) => t.departmentId === d.departmentId)?._count ?? 0 })).sort((a, b) => b.students - a.students);
  return { total, all, tookMock: took.reduce((t, x) => t + x._count, 0), departments, students: rows.map((r) => ({ ...r, mocks: mocks(r.userId) })) };
});
