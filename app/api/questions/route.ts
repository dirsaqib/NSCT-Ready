import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { ownerDepartmentFor, QuestionInput, SubjectEnum, createQuestion, similarQuestions } from "@/lib/questions";

/**
 * Faculty, HODs and focal persons see their own submissions, items assigned to them for review, and
 * weak practice questions to fix. They never see questions reserved for live national tests.
 * The super admin sees everything.
 */
export const GET = handle(async (req: Request) => {
  const u = await requireRole("FACULTY");
  const sp = new URL(req.url).searchParams;
  const subject = SubjectEnum.optional().parse(sp.get("subject") || undefined);
  const status = z.enum(["DRAFT", "SUBMITTED", "PEER_REVIEW", "EXPERT_REVIEW", "LIVE", "RETIRED"]).optional().parse(sp.get("status") || undefined);
  const view = sp.get("view") ?? (u.role === "ADMIN" ? "all" : "mine");
  const base = { ...(subject ? { subject } : {}), ...(status ? { status } : {}) };

  let where: object;
  if (u.role === "ADMIN" && view === "all") where = base;
  else if (view === "assigned") where = { ...base, reviews: { some: { reviewerId: u.id, decision: null } } };
  else if (view === "department") where = { ...base, scope: "DEPARTMENT", ownerDepartmentId: { in: await departmentsInScope(u, sp.get("departmentId")) } };
  else if (view === "weak") where = { ...base, scope: "NATIONAL", status: "LIVE", secure: false, OR: [{ reports: { some: { resolved: false } } }, { discrimination: { lt: 0.1 } }, { timesSeen: { gte: 30 }, timesRight: { lte: 5 } }] };
  else where = { ...base, authorId: u.id };

  const [questions, counts] = await Promise.all([
    prisma.question.findMany({
      where, orderBy: { createdAt: "desc" }, take: 300,
      include: { scenario: true, author: { select: { email: true } }, reviews: { select: { stage: true, decision: true, note: true, reviewerId: true, reviewer: { select: { email: true } } } }, _count: { select: { reports: { where: { resolved: false } }, versions: true } } },
    }),
    u.role === "ADMIN" ? prisma.question.groupBy({ by: ["status"], _count: true }) : Promise.resolve([]),
  ]);
  // Hide answers of live questions from non-admins except for their own submissions.
  const safe = questions.map((q) => (u.role !== "ADMIN" && q.authorId !== u.id && view !== "assigned" && view !== "weak" && view !== "department" ? { ...q, answers: [], tests: null } : q));
  return { questions: safe, counts };
});

/** Departments whose own bank this staff member may see. */
async function departmentsInScope(u: { role: string; universityId: string | null; campusId: string | null; departmentId: string | null }, requested: string | null) {
  const where = u.role === "ADMIN" ? {} : (u.role === "HOD" || u.role === "FACULTY") && u.departmentId ? { id: u.departmentId }
    : u.role === "CAMPUS_ADMIN" ? { campusId: u.campusId ?? "-" } : { campus: { universityId: u.universityId ?? "-" } };
  const ids = (await prisma.department.findMany({ where, select: { id: true } })).map((d) => d.id);
  return requested ? ids.filter((i) => i === requested) : ids;
}

/** Submit a question. Duplicates are refused. Near duplicates are returned as a warning. */
export const POST = handle(async (req: Request) => {
  const u = await requireRole("FACULTY");
  const d = QuestionInput.parse(await req.json());
  if (u.role !== "ADMIN") d.secure = false;
  const owner = d.bank === "DEPARTMENT" ? await ownerDepartmentFor(u, d.departmentId) : null;
  const q = await createQuestion(d, u.id, u.universityId, u.role === "ADMIN", owner);
  await audit(u.id, "question.create", q.id);
  return { question: q, similar: await similarQuestions(d.subject, d.text, q.id) };
});
