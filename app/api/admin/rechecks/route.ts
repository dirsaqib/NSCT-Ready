import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

/** Re-check requests and wrong-question reports from students. */
export const GET = handle(async () => {
  await requireRole("ADMIN");
  const [rechecks, reports] = await Promise.all([
    prisma.recheckRequest.findMany({
      where: { status: "OPEN" }, orderBy: { createdAt: "asc" },
      include: { user: { select: { profile: { select: { fullName: true } } } }, attempt: { select: { type: true, items: { select: { position: true, chosen: true, optionOrder: true, question: { select: { id: true, text: true, options: true, answers: true, explanation: true } } } } } } },
    }),
    prisma.questionReport.findMany({ where: { resolved: false }, orderBy: { createdAt: "asc" }, include: { question: { select: { id: true, text: true, options: true, answers: true } } } }),
  ]);
  return {
    rechecks: rechecks.map((r) => ({ ...r, item: r.attempt.items.find((i) => i.position === r.position), attempt: { type: r.attempt.type } })),
    reports,
  };
});

/**
 * Answer a re-check. If upheld with "creditAll", every student who answered that question in this
 * test type gets full credit for it and their attempt score is recalculated.
 */
export const POST = handle(async (req: Request) => {
  const u = await requireRole("ADMIN");
  const b = z.union([
    z.object({ kind: z.literal("recheck"), id: z.string(), status: z.enum(["UPHELD", "REJECTED"]), response: z.string().min(3).max(1000), creditAll: z.boolean().default(false) }),
    z.object({ kind: z.literal("report"), id: z.string() }),
  ]).parse(await req.json());
  if (b.kind === "report") { await prisma.questionReport.update({ where: { id: b.id }, data: { resolved: true } }); return { ok: true }; }

  const r = await prisma.recheckRequest.update({ where: { id: b.id }, data: { status: b.status, response: b.response } });
  if (b.status === "UPHELD") {
    const item = await prisma.attemptItem.findUnique({ where: { attemptId_position: { attemptId: r.attemptId, position: r.position } } });
    if (item) {
      const items = b.creditAll ? await prisma.attemptItem.findMany({ where: { questionId: item.questionId, attempt: { submittedAt: { not: null } } } }) : [item];
      for (const it of items) {
        if (it.credit === 1) continue;
        await prisma.attemptItem.update({ where: { id: it.id }, data: { correct: true, credit: 1 } });
        const all = await prisma.attemptItem.findMany({ where: { attemptId: it.attemptId }, select: { credit: true } });
        const raw = all.reduce((s, x) => s + (x.credit ?? 0), 0);
        await prisma.attempt.update({ where: { id: it.attemptId }, data: { correct: raw, score: Math.round((100 * raw) / Math.max(1, all.length)) } });
      }
      if (b.creditAll) await prisma.question.update({ where: { id: item.questionId }, data: { status: "RETIRED" } });
    }
  }
  await notify([r.userId], `Re-check ${b.status === "UPHELD" ? "accepted" : "answered"}`, b.response, ["EMAIL"], `/test/${r.attemptId}`);
  await audit(u.id, `recheck.${b.status.toLowerCase()}`, r.id, { creditAll: b.creditAll });
  return { ok: true };
});
