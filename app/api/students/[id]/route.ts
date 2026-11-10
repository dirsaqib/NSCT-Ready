import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, profileScope, HttpError, type SessionUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

async function inScope(u: SessionUser, userId: string) {
  const p = await prisma.profile.findFirst({ where: { userId, ...profileScope(u) } });
  if (!p) throw new HttpError(404, "Student not found in your university.");
  return p;
}

/** One student's full record for staff. */
export const GET = handle(async (_req: Request, ctx: { params: { id: string } }) => {
  const u = await requireRole("HOD");
  await inScope(u, ctx.params.id);
  const [user, mastery, topics, attempts] = await Promise.all([
    prisma.user.findUnique({ where: { id: ctx.params.id }, select: { email: true, phone: true, status: true, lastSeenAt: true, profile: { include: { campus: true, department: true } } } }),
    prisma.mastery.findMany({ where: { userId: ctx.params.id } }),
    prisma.topicMastery.findMany({ where: { userId: ctx.params.id, total: { gte: 2 } } }),
    prisma.attempt.findMany({ where: { userId: ctx.params.id, submittedAt: { not: null } }, orderBy: { submittedAt: "desc" }, take: 100, select: { id: true, type: true, label: true, score: true, percentile: true, startedAt: true, submittedAt: true, tabSwitches: true, flags: true } }),
  ]);
  await audit(u.id, "student.view", ctx.params.id);
  return { user, mastery, topics, attempts };
});

const Patch = z.object({
  action: z.enum(["verify", "reject", "activate", "deactivate", "edit"]),
  reason: z.string().max(300).optional(),
  edit: z.object({
    fullName: z.string().trim().min(2).max(80).optional(), rollNumber: z.string().trim().min(2).max(40).optional(), program: z.string().max(80).optional(),
    semester: z.string().max(20).optional(), section: z.string().max(20).optional(), campusId: z.string().nullable().optional(), departmentId: z.string().nullable().optional(),
    extraTimePct: z.number().int().min(0).max(100).optional(),
  }).optional(),
});

/** Verify, reject, activate, deactivate or correct a student record. */
export const PATCH = handle(async (req: Request, ctx: { params: { id: string } }) => {
  const u = await requireRole("HOD");
  const b = Patch.parse(await req.json());
  if (b.action !== "edit" && u.role === "HOD") throw new HttpError(403, "Only focal persons and campus admins verify students.");
  await inScope(u, ctx.params.id);
  const id = ctx.params.id;
  if (b.action === "verify") {
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { status: "VERIFIED" } }),
      prisma.profile.update({ where: { userId: id }, data: { verifiedById: u.id, verifiedAt: new Date(), rejectReason: null } }),
    ]);
    await notify([id], "Your account is verified", "You can now take full mock tests.", ["EMAIL", "SMS"], "/dashboard");
  } else if (b.action === "reject") {
    await prisma.profile.update({ where: { userId: id }, data: { rejectReason: b.reason || "Details could not be matched with university records." } });
    await notify([id], "Please check your details", b.reason || "Your university could not verify your details. Please correct your roll number or program.", ["EMAIL"], "/profile");
  } else if (b.action === "activate") {
    await prisma.user.update({ where: { id }, data: { status: "ACTIVE" } });
  } else if (b.action === "deactivate") {
    await prisma.user.update({ where: { id }, data: { status: "BLOCKED" } });
  } else if (b.edit) {
    await prisma.profile.update({ where: { userId: id }, data: b.edit });
  }
  await audit(u.id, `student.${b.action}`, id, b.reason ? { reason: b.reason } : undefined);
  return { ok: true };
});
