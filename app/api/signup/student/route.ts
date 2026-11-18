export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { normalisePhone } from "@/lib/otp";
import { hashPassword, passwordProblem } from "@/lib/password";
import { readProof, str, emailTaken, cnicFields, matchPlace, resolveUniversity } from "@/lib/register";

const Body = z.object({
  fullName: z.string().min(2, "Enter your full name.").max(80),
  universityId: z.string().optional(),
  universityName: z.string().max(120).optional(),
  campusName: z.string().max(80).optional(),
  departmentName: z.string().min(2, "Enter your department.").max(100),
  program: z.string().min(2).max(80),
  semester: z.string().min(1).max(20),
  section: z.string().max(20).optional(),
  rollNumber: z.string().min(2).max(40),
  gender: z.enum(["Male", "Female"], { errorMap: () => ({ message: "Choose Male or Female." }) }),
  cnic: z.string().min(13, "Enter your CNIC or B-Form number."),
  email: z.string().email("Enter a valid email.").max(120),
  phone: z.string().min(10, "Enter your mobile number.").max(20),
  city: z.string().max(60).optional(),
  password: z.string(),
});
const FIELDS = ["fullName", "universityId", "universityName", "campusName", "departmentName", "program", "semester", "section", "rollNumber", "gender", "cnic", "email", "phone", "city", "password"];

/**
 * Student self-registration with proof of being a current student. The account starts as PENDING and goes
 * to the university focal person, who checks the proof and approves it.
 */
export const POST = handle(async (req: Request) => {
  const form = await req.formData();
  const b = Body.parse(Object.fromEntries(FIELDS.map((k) => [k, str(form, k) || undefined])));
  if (str(form, "consent") !== "yes") throw new HttpError(400, "Please accept the privacy policy and terms to register.");
  const bad = passwordProblem(b.password);
  if (bad) throw new HttpError(400, bad);
  const phone = normalisePhone(b.phone);
  const cnic = cnicFields(b.cnic);
  const proof = await readProof(form);
  const email = b.email.toLowerCase();
  if (await emailTaken(email)) throw new HttpError(409, "This email is already registered. Sign in instead.");
  if (await prisma.user.findUnique({ where: { phone } })) throw new HttpError(409, "This mobile number is already registered.");
  if (await prisma.profile.findFirst({ where: { cnicHash: cnic.cnicHash }, select: { userId: true } })) throw new HttpError(409, "An account with this CNIC already exists. Sign in, or ask your focal person to reset your password.");
  const universityId = await resolveUniversity(b.universityId, b.universityName);
  if (await prisma.profile.findUnique({ where: { universityId_rollNumber: { universityId, rollNumber: b.rollNumber } } }))
    throw new HttpError(409, "This roll number is already registered at your university. Sign in, or ask your focal person to reset your password.");
  const place = await matchPlace(universityId, b.campusName ?? "", b.departmentName);

  const user = await prisma.user.create({
    data: {
      name: b.fullName, email, phone, role: "STUDENT", status: "PENDING", passwordHash: hashPassword(b.password),
      universityId, campusId: place.campusId, departmentId: place.departmentId,
      profile: {
        create: {
          fullName: b.fullName, universityId, campusId: place.campusId, departmentId: place.departmentId,
          campusName: b.campusName || null, departmentName: b.departmentName, program: b.program, semester: b.semester, section: b.section || null,
          rollNumber: b.rollNumber, city: b.city || null, gender: b.gender, consentResearch: true, ...cnic,
        },
      },
      uploads: { create: { kind: "ENROLLMENT_PROOF", ...proof } },
    },
  });
  const focal = await prisma.user.findMany({ where: { universityId, role: { in: ["FOCAL", "CAMPUS_ADMIN"] }, status: { not: "PENDING" } }, select: { id: true } });
  await notify(focal.map((f) => f.id), "New student to verify", `${b.fullName} (${b.rollNumber}) registered with proof of enrollment.`, ["EMAIL"], "/students?status=PENDING").catch(() => {});
  await audit(user.id, "signup.student", universityId);
  return { ok: true };
});
