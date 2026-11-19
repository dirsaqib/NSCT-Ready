export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { submitAttempt, AnswerSchema as Answer } from "@/lib/tests";

export const POST = handle(async (req: Request, ctx: { params: { id: string } }) => {
  const u = await requireUser();
  const b = z.object({ answers: z.array(Answer).max(200), tabSwitches: z.number().int().min(0).optional(), fullscreenExits: z.number().int().min(0).optional(), reason: z.enum(["LEFT_TEST_WINDOW", "EXITED_FULLSCREEN", "CLOSED_TEST", "TIME_UP"]).optional() }).parse(await req.json());
  return submitAttempt(u.id, ctx.params.id, b.answers, b.tabSwitches ?? 0, b.fullscreenExits ?? 0, b.reason);
});
