// Cheating alerts computed when a test is submitted.
import { prisma } from "./db";
import { getSetting } from "./settings";

export async function integrityFlags(attemptId: string) {
  const a = await prisma.attempt.findUnique({ where: { id: attemptId }, include: { items: { select: { questionId: true, chosen: true, timeSec: true } } } });
  if (!a || !a.submittedAt) return [];
  const flags: string[] = [];
  const minPerQ = await getSetting<number>("test.fastCompletionSecPerQuestion");
  const maxTabs = await getSetting<number>("test.maxTabSwitches");
  const secs = (a.submittedAt.getTime() - a.startedAt.getTime()) / 1000;

  if (a.items.length >= 10 && secs < a.items.length * minPerQ && a.score >= 70) flags.push("FAST_HIGH_SCORE");
  if (a.tabSwitches > maxTabs) flags.push("TAB_SWITCHING");
  if (a.fullscreenExits > 2) flags.push("FULLSCREEN_EXITS");

  // Same IP or device used by a different student in the same 3 hour window.
  const near = { gte: new Date(a.startedAt.getTime() - 3 * 3600000), lte: new Date(a.startedAt.getTime() + 3 * 3600000) };
  if (a.deviceHash) {
    const n = await prisma.attempt.count({ where: { deviceHash: a.deviceHash, userId: { not: a.userId }, startedAt: near } });
    if (n) flags.push("SHARED_DEVICE");
  }
  if (a.ip && (a.type === "NATIONAL_MOCK" || a.type === "MOCK")) {
    const n = await prisma.attempt.count({ where: { ip: a.ip, userId: { not: a.userId }, type: a.type, startedAt: near } });
    if (n >= 3) flags.push("SHARED_IP");
  }

  // Answer pattern: near-identical wrong answers with another attempt on the same questions.
  if (a.type === "NATIONAL_MOCK") {
    const others = await prisma.attempt.findMany({
      where: { type: "NATIONAL_MOCK", id: { not: a.id }, startedAt: near, submittedAt: { not: null } },
      take: 300,
      include: { items: { select: { questionId: true, chosen: true, correct: true } } },
    });
    const mine = new Map(a.items.map((i) => [i.questionId, i.chosen.join(",")]));
    for (const o of others) {
      let sameWrong = 0, overlap = 0;
      for (const i of o.items) {
        const m = mine.get(i.questionId);
        if (m == null) continue;
        overlap++;
        if (!i.correct && m === i.chosen.join(",") && m !== "") sameWrong++;
      }
      if (overlap >= 20 && sameWrong >= 8) { flags.push("ANSWER_PATTERN"); break; }
    }
  }
  if (flags.length) await prisma.attempt.update({ where: { id: a.id }, data: { flags } });
  return flags;
}

/** Percentile among submitted attempts of the same type in the last 30 days. */
export async function percentileFor(attemptId: string) {
  const a = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!a) return null;
  const since = new Date(Date.now() - 30 * 86400000);
  const [below, total] = await Promise.all([
    prisma.attempt.count({ where: { type: a.type, submittedAt: { gte: since }, score: { lt: a.score } } }),
    prisma.attempt.count({ where: { type: a.type, submittedAt: { gte: since } } }),
  ]);
  const p = total > 1 ? Math.round((100 * below) / (total - 1)) : null;
  await prisma.attempt.update({ where: { id: a.id }, data: { percentile: p } });
  return p;
}

/** Nightly job: point-biserial discrimination per question (how well it separates strong and weak students). */
export async function recomputeDiscrimination() {
  const qs = await prisma.question.findMany({ where: { status: "LIVE", timesSeen: { gte: 30 } }, select: { id: true } });
  for (const q of qs) {
    const items = await prisma.attemptItem.findMany({ where: { questionId: q.id, correct: { not: null } }, take: 2000, select: { correct: true, attempt: { select: { score: true } } } });
    const n = items.length;
    if (n < 30) continue;
    const scores = items.map((i) => i.attempt.score);
    const mean = scores.reduce((s, x) => s + x, 0) / n;
    const sd = Math.sqrt(scores.reduce((s, x) => s + (x - mean) ** 2, 0) / n) || 1;
    const right = items.filter((i) => i.correct);
    const p = right.length / n;
    if (p === 0 || p === 1) continue;
    const m1 = right.reduce((s, i) => s + i.attempt.score, 0) / right.length;
    const m0 = items.filter((i) => !i.correct).reduce((s, i) => s + i.attempt.score, 0) / (n - right.length);
    const r = ((m1 - m0) / sd) * Math.sqrt(p * (1 - p));
    await prisma.question.update({ where: { id: q.id }, data: { discrimination: Math.round(r * 100) / 100 } });
  }
}
