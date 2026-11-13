export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

/** One user's full record. */
export const GET = handle(async (_req: Request, ctx: { params: { id: string } }) => {
  const u = await requireRole("ADMIN");
  const user = await prisma.user.findUnique({
    where: { id: ctx.params.id },
    include: {
      university: true, campus: true, department: true, employer: true, sponsor: true,
      profile: { include: { university: true, campus: true, department: true } },
      attempts: { where: { submittedAt: { not: null } }, orderBy: { submittedAt: "desc" }, take: 100 },
      mastery: true,
      topics: { orderBy: { total: "desc" }, take: 50 },
      aiUsage: { orderBy: { day: "desc" }, take: 30 },
      payments: { orderBy: { createdAt: "desc" }, include: { invoice: true } },
      certificates: true,
      reports: { take: 20 },
      _count: { select: { mistakes: true, authored: true, bookmarks: true, threads: true, tickets: true } },
    },
  });
  if (!user) throw new HttpError(404, "User not found.");
  const { totpSecret: _s, ...safe } = user;
  await audit(u.id, "user.view", user.id);
  return { user: safe };
});

const Patch = z.object({
  role: z.enum(["STUDENT", "FACULTY", "HOD", "CAMPUS_ADMIN", "FOCAL", "CHAIR", "GOV", "EMPLOYER", "SPONSOR", "ADMIN"]).optional(),
  status: z.enum(["PENDING", "VERIFIED", "ACTIVE", "BLOCKED"]).optional(),
  universityId: z.string().nullable().optional(),
  campusId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  employerId: z.string().nullable().optional(),
  sponsorId: z.string().nullable().optional(),
  reset2fa: z.boolean().optional(),
  proUntil: z.string().datetime().nullable().optional(),
});

/** Assign a role and its place in the hierarchy, approve or block, reset two-factor, grant Pro. */
export const PATCH = handle(async (req: Request, ctx: { params: { id: string } }) => {
  const u = await requireRole("ADMIN");
  const b = Patch.parse(await req.json());
  const role = b.role;
  if ((role === "FOCAL" || role === "CHAIR") && !b.universityId) throw new HttpError(400, "Choose the university for this role.");
  if (role === "CAMPUS_ADMIN" && !b.campusId) throw new HttpError(400, "Choose the campus.");
  if (role === "HOD" && !b.departmentId) throw new HttpError(400, "Choose the department.");
  if (role === "EMPLOYER" && !b.employerId) throw new HttpError(400, "Choose the employer.");
  if (role === "SPONSOR" && !b.sponsorId) throw new HttpError(400, "Choose the sponsor.");
  if (ctx.params.id === u.id && (b.status === "BLOCKED" || (role && role !== "ADMIN"))) throw new HttpError(400, "You cannot block or demote yourself.");
  const { reset2fa, proUntil, ...rest } = b;
  await prisma.user.update({
    where: { id: ctx.params.id },
    data: { ...rest, ...(reset2fa ? { totpEnabled: false, totpSecret: null } : {}), ...(proUntil !== undefined ? { proUntil: proUntil ? new Date(proUntil) : null } : {}) },
  });
  if (b.status === "BLOCKED") await notify([ctx.params.id], "Your account has been blocked", "Contact support if you think this is a mistake.", ["EMAIL"]);
  await audit(u.id, "user.update", ctx.params.id, b);
  return { ok: true };
});
