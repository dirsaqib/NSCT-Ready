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
  email: z.string().email().max(120),
  phone: z.string().min(10).max(20),
  universityId: z.string().min(1, "Choose your university."),
  campusId: z.string().optional(),
  designation: z.string().min(2).max(80),
  password: z.string(),
});

/** Focal person self-registration with an appointment letter or university ID. The super admin approves it. */
export const POST = handle(async (req: Request) => {
  const form = await req.formData();
  const b = Body.parse(Object.fromEntries(["fullName", "email", "phone", "universityId", "campusId", "designation", "password"].map((k) => [k, str(form, k) || undefined])));
  const bad = passwordProblem(b.password);
  if (bad) throw new HttpError(400, bad);
  const proof = await readProof(form);
  const email = b.email.toLowerCase();
  if (!(await prisma.university.findUnique({ where: { id: b.universityId }, select: { id: true } }))) throw new HttpError(400, "Choose your university.");
  if (b.campusId) {
    const c = await prisma.campus.findUnique({ where: { id: b.campusId } });
    if (c?.universityId !== b.universityId) throw new HttpError(400, "That campus does not belong to the university.");
  }
  if (await emailTaken(email)) throw new HttpError(409, "This email is already registered. Sign in instead.");
  if (await prisma.user.findUnique({ where: { phone: b.phone } })) throw new HttpError(409, "This phone number is already registered.");

  const user = await prisma.user.create({
    data: {
      name: b.fullName, email, phone: b.phone, role: "FOCAL", status: "PENDING", designation: b.designation, passwordHash: hashPassword(b.password),
      universityId: b.universityId, campusId: b.campusId || null, uploads: { create: { kind: "FOCAL_PROOF", ...proof } },
    },
  });
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await notify(admins.map((a) => a.id), "Focal person to approve", `${b.fullName} (${b.designation}) registered as focal person.`, ["EMAIL"], "/admin/approvals").catch(() => {});
  await audit(user.id, "signup.focal", b.universityId);
  return { ok: true };
});
