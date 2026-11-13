export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { explainMistake, useQuota } from "@/lib/ai";
import { hasPro } from "@/lib/payments";
import { getSetting } from "@/lib/settings";

const Body = z.object({ attemptId: z.string(), position: z.number().int().min(0), lang: z.enum(["English", "Urdu", "Roman Urdu"]).default("English") });

export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const b = Body.parse(await req.json());
  const it = await prisma.attemptItem.findUnique({
    where: { attemptId_position: { attemptId: b.attemptId, position: b.position } },
    include: { attempt: true, question: true },
  });
  if (!it || it.attempt.userId !== u.id) throw new HttpError(404, "Question not found.");
  // Only explain once the answer is known to the student (after submit, or after a practice check).
  const practice = it.attempt.type === "PRACTICE" || it.attempt.type === "MISTAKES";
  if (!it.attempt.submittedAt && !(practice && it.chosen.length > 0)) throw new HttpError(400, "Submit your answer first.");
  await useQuota(u.id, 1, (await hasPro(u.id)) ? undefined : await getSetting<number>("pricing.freeAiCallsPerDay"));
  return { text: await explainMistake(it.question, it.chosen, b.lang) };
});
