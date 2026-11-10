import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { runSample } from "@/lib/tests";

/** Run code against the visible sample tests. */
export const POST = handle(async (req: Request, ctx: { params: { id: string } }) => {
  const u = await requireUser();
  const b = z.object({ position: z.number().int().min(0), code: z.string().max(20000) }).parse(await req.json());
  return runSample(u.id, ctx.params.id, b.position, b.code);
});
