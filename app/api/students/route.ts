import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, profileScope } from "@/lib/auth";
import { handle } from "@/lib/http";

/** Students in the staff member's part of the hierarchy, with filters. */
export const GET = handle(async (req: Request) => {
  const u = await requireRole("HOD");
  const sp = new URL(req.url).searchParams;
  const f = z.object({
    status: z.enum(["PENDING", "VERIFIED", "ACTIVE", "BLOCKED"]).optional(),
    campusId: z.string().optional(), departmentId: z.string().optional(), program: z.string().optional(), section: z.string().optional(),
    q: z.string().optional(), universityId: z.string().optional(), page: z.coerce.number().int().min(0).default(0),
  }).parse(Object.fromEntries(sp));
  const scope = profileScope(u, f.universityId);
  const where = {
    ...scope,
    ...(f.campusId && !scope.campusId ? { campusId: f.campusId } : {}),
    ...(f.departmentId && !scope.departmentId ? { departmentId: f.departmentId } : {}),
    ...(f.program ? { program: f.program } : {}),
    ...(f.section ? { section: f.section } : {}),
    ...(f.status ? { user: { status: f.status } } : {}),
    ...(f.q ? { OR: [{ fullName: { contains: f.q, mode: "insensitive" as const } }, { rollNumber: { contains: f.q, mode: "insensitive" as const } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.profile.count({ where }),
    prisma.profile.findMany({
      where, orderBy: { createdAt: "desc" }, skip: f.page * 200, take: 200,
      include: { user: { select: { id: true, email: true, phone: true, status: true, lastSeenAt: true, _count: { select: { attempts: true } } } }, campus: { select: { name: true } }, department: { select: { name: true } } },
    }),
  ]);
  return { total, students: rows };
});
