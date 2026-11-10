import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";

const Body = z.object({ reason: z.string().trim().min(3).max(500) });

/** "Report this question" from students. Faculty see open reports in the question bank. */
export const POST = handle(async (req: Request, ctx: { params: { id: string } }) => {
  const u = await requireUser();
  const b = Body.parse(await req.json());
  await prisma.questionReport.create({ data: { questionId: ctx.params.id, userId: u.id, reason: b.reason } });
  return { ok: true };
});
