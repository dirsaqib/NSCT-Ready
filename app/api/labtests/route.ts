export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { requireRole, profileScope } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { createLabTest } from "@/lib/labtests";

const STAFF = ["HOD", "CAMPUS_ADMIN", "FOCAL", "CHAIR", "ADMIN"];

/** Lab tests in the staff member's university, campus or department. */
export const GET = handle(async () => {
  const u = await requireRole("HOD");
  const s = profileScope(u);
  const tests = await prisma.labTest.findMany({
    where: { ...(s.universityId ? { universityId: s.universityId } : {}), ...(s.departmentId ? { departmentId: s.departmentId } : {}), ...(s.campusId ? { OR: [{ campusId: s.campusId }, { campusId: null }] } : {}) },
    orderBy: { opensAt: "desc" }, take: 100,
    include: { _count: { select: { attempts: true } } },
  });
  const departments = await prisma.department.findMany({
    where: s.departmentId ? { id: s.departmentId } : s.campusId ? { campusId: s.campusId } : s.universityId ? { campus: { universityId: s.universityId } } : {},
    select: { id: true, name: true, programs: true, campus: { select: { id: true, name: true } } }, orderBy: { name: "asc" }, take: 300,
  });
  return { tests: tests.map(({ packageSecret, ...t }) => ({ ...t, questions: t.questionIds.length })), departments };
});

export const POST = handle(async (req: Request) => {
  const u = await requireRole("HOD");
  if (!STAFF.includes(u.role)) throw new HttpError(403, "Only HODs, campus admins and focal persons can schedule lab tests.");
  const t = await createLabTest(u, await req.json());
  await audit(u.id, "labtest.create", t.id, { mode: t.mode, questions: t.questionIds.length });
  const { packageSecret, ...safe } = t;
  return { test: safe };
});
