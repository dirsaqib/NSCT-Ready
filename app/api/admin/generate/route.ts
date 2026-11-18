export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { generateQuestions, verifyAnswer } from "@/lib/ai";
import { createQuestion, QuestionInput } from "@/lib/questions";
import { shuffle } from "@/lib/scoring";

const SUBJECT = z.enum(["PS", "PROG", "DSA", "DB", "SE", "WEB", "AI", "NET", "OS", "SEC"]);

/** Bank size per subject: live, waiting for review. */
export const GET = handle(async () => {
  await requireRole("ADMIN");
  const rows = await prisma.question.groupBy({ by: ["subject", "status"], where: { scope: "NATIONAL" }, _count: true });
  return { rows, aiReady: !!process.env.ANTHROPIC_API_KEY };
});

/**
 * Generates one batch of up to 10 questions. Each one is double-checked by a second model:
 * if it agrees with the answer key the question goes live (when autoPublish is on), otherwise it waits for a reviewer.
 */
export const POST = handle(async (req: Request) => {
  const u = await requireRole("ADMIN");
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(400, "Add ANTHROPIC_API_KEY in Vercel to use the generator.");
  const b = z.object({ subject: SUBJECT, topic: z.string().max(60).optional(), count: z.number().int().min(1).max(10).default(10), autoPublish: z.boolean().default(false), difficulty: z.number().int().min(1).max(3).optional() }).parse(await req.json());
  const drafts = await generateQuestions(b.subject, b.topic ? `${b.topic}${b.difficulty ? `, difficulty ${b.difficulty} of 3` : ""}` : b.difficulty ? `mixed topics, difficulty ${b.difficulty} of 3` : undefined, b.count);
  let live = 0, review = 0, duplicate = 0, failed = 0;
  for (const g of drafts) {
    // Move the correct answer to a random position so it is not always first.
    const order = shuffle([0, 1, 2, 3]);
    const options = order.map((i) => g.options[i]);
    const answer = order.indexOf(g.answer);
    const parsed = QuestionInput.safeParse({ type: "SINGLE", subject: b.subject, topic: (b.topic || g.topic || "General").slice(0, 60), difficulty: b.difficulty ?? g.difficulty ?? 2, text: g.q, code: g.code || null, options, answers: [answer], explanation: g.explanation, source: "AI_REVIEWED" });
    if (!parsed.success) { failed++; continue; }
    const ok = b.autoPublish && (await verifyAnswer({ text: g.q, code: g.code, options }, answer));
    try {
      await createQuestion(parsed.data, u.id, null, ok);
      if (ok) live++; else review++;
    } catch (e) {
      if (e instanceof HttpError && e.status === 409) duplicate++; else failed++;
    }
  }
  await audit(u.id, "questions.generate", b.subject, { topic: b.topic, live, review, duplicate, failed });
  return { live, review, duplicate, failed };
});
