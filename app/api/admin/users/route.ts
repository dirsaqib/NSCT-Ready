import type { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";

const STAFF_ROLES: Role[] = ["FACULTY", "HOD", "CAMPUS_ADMIN", "FOCAL", "CHAIR", "ADMIN"];

const Q = z.object({
  q: z.string().optional(),
  universityId: z.string().optional(),
  role: z.enum(["STUDENT", "FACULTY", "HOD", "CAMPUS_ADMIN", "FOCAL", "CHAIR", "GOV", "EMPLOYER", "SPONSOR", "ADMIN"]).optional(),
  status: z.enum(["PENDING", "VERIFIED", "ACTIVE", "BLOCKED"]).optional(),
  staff: z.string().optional(),
  page: z.coerce.number().int().min(0).default(0),
});

/** Every user, with search and filters. 100 per page. */
export const GET = handle(async (req: Request) => {
  await requireRole("ADMIN");
  const f = Q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const where = {
    ...(f.role ? { role: f.role } : f.staff ? { role: { in: STAFF_ROLES } } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.universityId ? { universityId: f.universityId } : {}),
    ...(f.q ? { OR: [{ email: { contains: f.q, mode: "insensitive" as const } }, { phone: { contains: f.q } }, { profile: { fullName: { contains: f.q, mode: "insensitive" as const } } }, { profile: { rollNumber: { contains: f.q, mode: "insensitive" as const } } }] } : {}),
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: f.page * 100,
      take: 100,
      select: {
        id: true, email: true, phone: true, role: true, status: true, lastSeenAt: true, totpEnabled: true, proUntil: true, createdAt: true, universityId: true, campusId: true, departmentId: true, employerId: true, sponsorId: true,
        university: { select: { name: true } },
        profile: { select: { fullName: true, rollNumber: true, program: true, semester: true, readiness: true, bestMock: true, points: true, leaderboard: true, talentPool: true, consentResearch: true } },
        _count: { select: { attempts: true } },
      },
    }),
  ]);
  return { total, users };
});
