import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { saveProgress, AnswerSchema as Answer } from "@/lib/tests";

/** Auto-save. The test screen calls this every 15 seconds and again after the connection returns. */
export const PATCH = handle(async (req: Request, ctx: { params: { id: string } }) => {
  const u = await requireUser();
  const b = z.object({ answers: z.array(Answer).max(200), tabSwitches: z.number().int().min(0).optional(), fullscreenExits: z.number().int().min(0).optional() }).parse(await req.json());
  return saveProgress(u.id, ctx.params.id, b.answers, b.tabSwitches, b.fullscreenExits);
});
