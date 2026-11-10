import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

const Body = z.object({
  fullName: z.string().trim().min(2).max(80),
  universityId: z.string().min(1),
  campusId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  program: z.string().trim().min(2).max(80),
  semester: z.string().trim().max(20),
  section: z.string().trim().max(20).optional(),
  rollNumber: z.string().trim().min(2).max(40),
  city: z.string().trim().max(60).optional(),
  alias: z.string().trim().max(24).optional(),
  gender: z.enum(["Female", "Male", "Prefer not to say"]).optional(),
  screenReader: z.boolean().optional(),
  consentResearch: z.literal(true, { errorMap: () => ({ message: "Consent is required to use the platform." }) }),
  leaderboard: z.boolean().default(false),
  talentPool: z.boolean().default(false),
});

export const GET = handle(async () => {
  const u = await requireUser();
  const [profile, user] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: u.id }, include: { university: true, campus: true, department: true } }),
    prisma.user.findUnique({ where: { id: u.id }, select: { status: true, email: true, phone: true, locale: true, totpEnabled: true, proUntil: true } }),
  ]);
  return { profile, account: user };
});

/**
 * Create or update the profile. A new profile, or a change of university or roll number, puts the
 * account back to PENDING until the university focal person verifies it.
 */
export const PUT = handle(async (req: Request) => {
  const u = await requireUser();
  const b = Body.parse(await req.json());
  if (b.campusId) {
    const c = await prisma.campus.findUnique({ where: { id: b.campusId } });
    if (c?.universityId !== b.universityId) throw new HttpError(400, "That campus does not belong to the university.");
  }
  const taken = await prisma.profile.findFirst({ where: { universityId: b.universityId, rollNumber: b.rollNumber, userId: { not: u.id } } });
  if (taken) throw new HttpError(409, "This roll number is already registered at your university. Contact your focal person if this is a mistake.");
  const before = await prisma.profile.findUnique({ where: { userId: u.id } });
  const identityChanged = !before || before.universityId !== b.universityId || before.rollNumber !== b.rollNumber;
  const data = { ...b, campusId: b.campusId || null, departmentId: b.departmentId || null, consentAt: new Date() };
  const profile = await prisma.profile.upsert({ where: { userId: u.id }, create: { userId: u.id, ...data }, update: { ...data, ...(identityChanged ? { verifiedAt: null, verifiedById: null } : {}) } });
  if (u.role === "STUDENT") {
    await prisma.user.update({
      where: { id: u.id },
      data: { universityId: b.universityId, campusId: data.campusId, departmentId: data.departmentId, name: b.fullName, ...(identityChanged ? { status: "PENDING" } : {}) },
    });
    if (identityChanged) {
      const focal = await prisma.user.findMany({ where: { universityId: b.universityId, role: { in: ["FOCAL", "CAMPUS_ADMIN"] } }, select: { id: true } });
      await notify(focal.map((f) => f.id), "New student to verify", `${b.fullName} (${b.rollNumber}) is waiting for verification.`, [], "/students?status=PENDING");
    }
  }
  await audit(u.id, before ? "profile.update" : "profile.create");
  return { profile };
});

/** Delete account and every record about the student. */
export const DELETE = handle(async () => {
  const u = await requireUser();
  await audit(u.id, "account.delete");
  await prisma.user.delete({ where: { id: u.id } });
  return { ok: true };
});
