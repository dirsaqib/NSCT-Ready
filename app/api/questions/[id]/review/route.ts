import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";

/** A peer reviewer records a decision. When every assigned peer approves, the question moves to expert review. */
export const POST = handle(async (req: Request, ctx: { params: { id: string } }) => {
  const u = await requireRole("FACULTY");
  const b = z.object({ decision: z.enum(["APPROVE", "REJECT"]), note: z.string().max(1000).optional() }).parse(await req.json());
  const r = await prisma.questionReview.findFirst({ where: { questionId: ctx.params.id, reviewerId: u.id, decision: null, stage: "PEER" } });
  if (!r) throw new HttpError(404, "No review is assigned to you for this question.");
  await prisma.questionReview.update({ where: { id: r.id }, data: { decision: b.decision, note: b.note, decidedAt: new Date() } });
  const all = await prisma.questionReview.findMany({ where: { questionId: ctx.params.id, stage: "PEER" } });
  if (all.some((x) => x.decision === "REJECT")) await prisma.question.update({ where: { id: ctx.params.id }, data: { status: "DRAFT" } });
  else if (all.every((x) => x.decision === "APPROVE")) await prisma.question.update({ where: { id: ctx.params.id }, data: { status: "EXPERT_REVIEW" } });
  await audit(u.id, `question.peer.${b.decision.toLowerCase()}`, ctx.params.id);
  return { ok: true };
});
