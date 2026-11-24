export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { normalisePhone } from "@/lib/otp";
import { hashPassword, passwordProblem } from "@/lib/password";
import { readProof, str, emailTaken, resolveUniversity, ensureDepartment, NAME_RE, EMAIL_RE, PHONE_RE } from "@/lib/register";

const Body = z.object({
  fullName: z.string().regex(NAME_RE, "Full name can contain letters only."),
  email: z.string().max(120).regex(EMAIL_RE, "Enter a valid email, like name@university.edu.pk."),
  phone: z.string().regex(PHONE_RE, "Enter a valid Pakistani mobile number, like 03001234567."),
  universityId: z.string().optional(),
  universityName: z.string().max(120).optional(),
  departmentName: z.string().max(100).regex(/^[\p{L}][\p{L} .,&()'-]{1,99}$/u, "Department can contain letters only.").optional(),
  designation: z.string().regex(/^[\p{L}][\p{L} .,&()'-]{2,79}$/u, "Designation can contain letters only."),
  password: z.string(),
});

/** Focal person self-registration with an appointment letter or university ID. The super admin approves it. */
export const POST = handle(async (req: Request) => {
  const form = await req.formData();
  const b = Body.parse(Object.fromEntries(["fullName", "email", "phone", "universityId", "universityName", "departmentName", "designation", "password"].map((k) => [k, str(form, k) || undefined])));
  const bad = passwordProblem(b.password);
  if (bad) throw new HttpError(400, bad);
  const proof = await readProof(form);
  const email = b.email.toLowerCase();
  const phone = normalisePhone(b.phone);
  if (str(form, "consent") !== "yes") throw new HttpError(400, "Please accept the privacy policy and terms to register.");
  if (await emailTaken(email)) throw new HttpError(409, "This email is already registered. Sign in instead.");
  if (await prisma.user.findUnique({ where: { phone } })) throw new HttpError(409, "This phone number is already registered.");

  const universityId = await resolveUniversity(b.universityId, b.universityName);
  // A department focal person sees only that department's students. Leaving it empty means the whole university.
  const dept = b.departmentName && !/^(whole|all|entire)\b/i.test(b.departmentName) ? await ensureDepartment(universityId, b.departmentName) : null;
  const user = await prisma.user.create({
    data: {
      name: b.fullName, email, phone, role: "FOCAL", status: "PENDING", designation: b.designation, passwordHash: hashPassword(b.password),
      universityId: universityId, departmentId: dept?.id ?? null, campusId: dept?.campusId ?? null, uploads: { create: { kind: "FOCAL_PROOF", ...proof } },
    },
  });
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await notify(admins.map((a) => a.id), "Focal person to approve", `${b.fullName} (${b.designation}) registered as focal person${b.departmentName ? ` for ${b.departmentName}` : " for the whole university"}.`, ["EMAIL"], "/admin/approvals").catch(() => {});
  await audit(user.id, "signup.focal", universityId);
  return { ok: true };
});
