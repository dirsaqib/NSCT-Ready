export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";

/** A student asks for a question in a submitted test to be re-checked. Admins answer in Re-checks. */
export const POST = handle(async (req: Request, ctx: { params: { id: string } }) => {
  const u = await requireUser();
  const b = z.object({ position: z.number().int().min(0), reason: z.string().trim().min(5).max(1000) }).parse(await req.json());
  const a = await prisma.attempt.findFirst({ where: { id: ctx.params.id, userId: u.id, submittedAt: { not: null } } });
  if (!a) throw new HttpError(404, "Submitted test not found.");
  if (Date.now() - a.submittedAt!.getTime() > 14 * 86400000) throw new HttpError(400, "Re-checks can be requested within 14 days.");
  const open = await prisma.recheckRequest.count({ where: { attemptId: a.id, position: b.position } });
  if (open) throw new HttpError(409, "You already asked for a re-check of this question.");
  return { recheck: await prisma.recheckRequest.create({ data: { attemptId: a.id, userId: u.id, position: b.position, reason: b.reason } }) };
});
