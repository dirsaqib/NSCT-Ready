export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { hashPassword, tempPassword } from "@/lib/password";
import { ensureDepartment } from "@/lib/register";

/** Focal persons for the super admin: pending registrations first, then approved ones. */
export const GET = handle(async (req: Request) => {
  await requireRole("ADMIN");
  const status = new URL(req.url).searchParams.get("status") || "PENDING";
  const focals = await prisma.user.findMany({
    where: { role: "FOCAL", ...(status === "ALL" ? {} : status === "PENDING" ? { status: "PENDING" } : { status: { not: "PENDING" } }) },
    orderBy: { createdAt: "desc" }, take: 500,
    select: {
      id: true, name: true, email: true, phone: true, designation: true, status: true, createdAt: true, lastSeenAt: true, totpEnabled: true,
      university: { select: { name: true } }, campus: { select: { name: true } }, department: { select: { name: true } }, uploads: { where: { kind: "FOCAL_PROOF" }, select: { id: true, filename: true } },
    },
  });
  const students = await prisma.profile.groupBy({ by: ["universityId"], _count: true });
  return { focals, studentsByUniversity: Object.fromEntries(students.map((s) => [s.universityId, s._count])) };
});

const Patch = z.object({ id: z.string(), action: z.enum(["approve", "reject", "block", "unblock", "resetPassword", "reset2fa", "setDepartment"]), reason: z.string().max(300).optional(), departmentName: z.string().max(100).optional() });

export const PATCH = handle(async (req: Request) => {
  const u = await requireRole("ADMIN");
  const b = Patch.parse(await req.json());
  const f = await prisma.user.findUnique({ where: { id: b.id } });
  if (!f || f.role !== "FOCAL") throw new HttpError(404, "Focal person not found.");
  let tempPw: string | undefined;
  if (b.action === "approve") {
    await prisma.user.update({ where: { id: f.id }, data: { status: "ACTIVE" } });
    await notify([f.id], "Your focal person account is approved", "You can now sign in, set up two-factor authentication and add your students.", ["EMAIL"], "/signin").catch(() => {});
  } else if (b.action === "reject") {
    await notify([f.id], "Focal person registration not approved", b.reason || "We could not confirm your appointment. Contact the NSCT team.", ["EMAIL"]).catch(() => {});
    await prisma.user.update({ where: { id: f.id }, data: { status: "BLOCKED" } });
  } else if (b.action === "block") {
    await prisma.user.update({ where: { id: f.id }, data: { status: "BLOCKED" } });
  } else if (b.action === "unblock") {
    await prisma.user.update({ where: { id: f.id }, data: { status: "ACTIVE" } });
  } else if (b.action === "setDepartment") {
    // Empty means the whole university.
    const name = (b.departmentName ?? "").trim();
    const d = name && f.universityId ? await ensureDepartment(f.universityId, name) : null;
    await prisma.user.update({ where: { id: f.id }, data: { departmentId: d?.id ?? null, campusId: d?.campusId ?? null } });
  } else if (b.action === "reset2fa") {
    await prisma.user.update({ where: { id: f.id }, data: { totpEnabled: false, totpSecret: null } });
  } else {
    tempPw = tempPassword();
    await prisma.user.update({ where: { id: f.id }, data: { passwordHash: hashPassword(tempPw, true), mustChangePassword: true, failedLogins: 0, lockedUntil: null } });
  }
  await audit(u.id, `focal.${b.action}`, f.id, b.reason ? { reason: b.reason } : undefined);
  return { ok: true, tempPassword: tempPw };
});
