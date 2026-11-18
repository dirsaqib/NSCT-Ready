export const dynamic = "force-dynamic";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";

/** Records that a student opened a video, for their preparation log. */
export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const { id } = z.object({ id: z.string().max(40) }).parse(await req.json());
  await audit(u.id, "study.video", id);
  return { ok: true };
});
