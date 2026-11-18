export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { hashPassword, passwordProblem } from "@/lib/password";
import { readProof, str, emailTaken } from "@/lib/register";

const Body = z.object({
  fullName: z.string().min(2).max(80),
  universityId: z.string().min(1, "Choose your university."),
  campusId: z.string().optional(),
  departmentId: z.string().optional(),
  program: z.string().min(2).max(80),
  semester: z.string().max(20),
  section: z.string().max(20).optional(),
  rollNumber: z.string().min(2).max(40),
  email: z.string().email().max(120).optional(),
  phone: z.string().max(20).optional(),
  city: z.string().max(60).optional(),
  gender: z.enum(["Female", "Male", "Prefer not to say"]).optional(),
  password: z.string(),
});

/**
 * Student self-registration with proof of current enrollment. The account starts as PENDING and goes
 * to the university focal person, who checks the proof and approves it.
 */
export const POST = handle(async (req: Request) => {
  const form = await req.formData();
  const raw = Object.fromEntries(["fullName", "universityId", "campusId", "departmentId", "program", "semester", "section", "rollNumber", "email", "phone", "city", "gender", "password"].map((k) => [k, str(form, k) || undefined]));
  const b = Body.parse(raw);
  if (str(form, "consent") !== "yes") throw new HttpError(400, "Please accept the privacy terms to register.");
  const bad = passwordProblem(b.password);
  if (bad) throw new HttpError(400, bad);
  const proof = await readProof(form);
  const email = b.email?.toLowerCase() ?? null;
  const uni = await prisma.university.findUnique({ where: { id: b.universityId }, select: { id: true } });
  if (!uni) throw new HttpError(400, "Choose your university.");
  if (b.campusId) {
    const c = await prisma.campus.findUnique({ where: { id: b.campusId } });
    if (c?.universityId !== b.universityId) throw new HttpError(400, "That campus does not belong to the university.");
  }
  if (await prisma.profile.findUnique({ where: { universityId_rollNumber: { universityId: b.universityId, rollNumber: b.rollNumber } } }))
    throw new HttpError(409, "This roll number is already registered at your university. Sign in, or ask your focal person to reset your password.");
  if (await emailTaken(email)) throw new HttpError(409, "This email is already registered. Sign in instead.");
  if (b.phone && (await prisma.user.findUnique({ where: { phone: b.phone } }))) throw new HttpError(409, "This phone number is already registered.");

  const user = await prisma.user.create({
    data: {
      name: b.fullName, email, phone: b.phone || null, role: "STUDENT", status: "PENDING", passwordHash: hashPassword(b.password),
      universityId: b.universityId, campusId: b.campusId || null, departmentId: b.departmentId || null,
      profile: { create: { fullName: b.fullName, universityId: b.universityId, campusId: b.campusId || null, departmentId: b.departmentId || null, program: b.program, semester: b.semester, section: b.section || null, rollNumber: b.rollNumber, city: b.city || null, gender: b.gender || null, consentResearch: true } },
      uploads: { create: { kind: "ENROLLMENT_PROOF", ...proof } },
    },
  });
  const focal = await prisma.user.findMany({ where: { universityId: b.universityId, role: { in: ["FOCAL", "CAMPUS_ADMIN"] }, status: { not: "PENDING" } }, select: { id: true } });
  await notify(focal.map((f) => f.id), "New student to verify", `${b.fullName} (${b.rollNumber}) registered with enrollment proof.`, ["EMAIL"], "/students?status=PENDING").catch(() => {});
  await audit(user.id, "signup.student", b.universityId);
  return { ok: true };
});
