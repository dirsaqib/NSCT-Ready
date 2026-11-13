import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { QuestionInput, assertNotDuplicate, saveVersion } from "@/lib/questions";
import { notify } from "@/lib/notify";

/**
 * Workflow: SUBMITTED > PEER_REVIEW (assigned reviewers) > EXPERT_REVIEW > LIVE.
 * Only the super admin assigns reviewers, gives final approval, edits live questions or retires them.
 */
const Patch = z.object({
  action: z.enum(["assign", "expert", "approve", "reject", "retire", "edit", "secure"]),
  reviewerIds: z.array(z.string()).max(5).optional(),
  note: z.string().max(1000).optional(),
  secure: z.boolean().optional(),
  edit: QuestionInput.innerType().partial().optional(),
});

export const PATCH = handle(async (req: Request, ctx: { params: { id: string } }) => {
  const u = await requireRole("FACULTY");
  const b = Patch.parse(await req.json());
  const q = await prisma.question.findUnique({ where: { id: ctx.params.id } });
  if (!q) throw new HttpError(404, "Question not found.");
  // Department staff manage their own department bank. Everything else is for the super admin.
  if (u.role !== "ADMIN") {
    const ownDept = q.scope === "DEPARTMENT" && q.authorUniversityId === u.universityId && (u.role === "FOCAL" || u.role === "CHAIR" || u.role === "CAMPUS_ADMIN" || q.ownerDepartmentId === u.departmentId);
    if (!ownDept || !["retire", "edit"].includes(b.action)) throw new HttpError(403, "Only the super admin can do this.");
  }

  switch (b.action) {
    case "assign": {
      if (!b.reviewerIds?.length) throw new HttpError(400, "Choose at least one reviewer.");
      if (b.reviewerIds.includes(q.authorId ?? "")) throw new HttpError(400, "The author cannot review their own question.");
      await prisma.$transaction([
        prisma.questionReview.createMany({ data: b.reviewerIds.map((reviewerId) => ({ questionId: q.id, reviewerId, stage: "PEER" })) }),
        prisma.question.update({ where: { id: q.id }, data: { status: "PEER_REVIEW" } }),
      ]);
      await notify(b.reviewerIds, "Question to review", "A question has been assigned to you for peer review.", ["EMAIL"], "/contribute?tab=review");
      break;
    }
    case "expert":
      await prisma.question.update({ where: { id: q.id }, data: { status: "EXPERT_REVIEW" } });
      break;
    case "approve":
      await prisma.$transaction([
        prisma.questionReview.create({ data: { questionId: q.id, reviewerId: u.id, stage: "EXPERT", decision: "APPROVE", note: b.note, decidedAt: new Date() } }),
        prisma.question.update({ where: { id: q.id }, data: { status: "LIVE" } }),
        ...(q.replacesId ? [prisma.question.update({ where: { id: q.replacesId }, data: { status: "RETIRED" } })] : []),
      ]);
      if (q.authorId) await notify([q.authorId], "Your question is live", `Your question on ${q.topic} was approved. Thank you.`, [], "/contribute?tab=mine");
      break;
    case "reject":
      await prisma.$transaction([
        prisma.questionReview.create({ data: { questionId: q.id, reviewerId: u.id, stage: "EXPERT", decision: "REJECT", note: b.note, decidedAt: new Date() } }),
        prisma.question.update({ where: { id: q.id }, data: { status: "DRAFT" } }),
      ]);
      if (q.authorId) await notify([q.authorId], "Your question needs changes", b.note || "Please see the reviewer note.", [], "/contribute?tab=mine");
      break;
    case "retire":
      await prisma.question.update({ where: { id: q.id }, data: { status: "RETIRED" } });
      break;
    case "secure":
      await prisma.question.update({ where: { id: q.id }, data: { secure: !!b.secure } });
      break;
    case "edit": {
      if (!b.edit) throw new HttpError(400, "Nothing to change.");
      await saveVersion(q.id, u.id);
      const text = b.edit.text ?? q.text, options = b.edit.options ?? q.options;
      const hash = await assertNotDuplicate({ text, options }, q.id);
      const { scenario: _s, replacesId: _r, ...rest } = b.edit;
      await prisma.question.update({ where: { id: q.id }, data: { ...rest, contentHash: hash, version: { increment: 1 } } });
      break;
    }
  }
  await audit(u.id, `question.${b.action}`, q.id, b.note ? { note: b.note } : undefined);
  return { ok: true };
});
