import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { submitAttempt, AnswerSchema as Answer } from "@/lib/tests";

export const POST = handle(async (req: Request, ctx: { params: { id: string } }) => {
  const u = await requireUser();
  const b = z.object({ answers: z.array(Answer).max(200), tabSwitches: z.number().int().min(0).optional(), fullscreenExits: z.number().int().min(0).optional() }).parse(await req.json());
  return submitAttempt(u.id, ctx.params.id, b.answers, b.tabSwitches ?? 0, b.fullscreenExits ?? 0);
});
