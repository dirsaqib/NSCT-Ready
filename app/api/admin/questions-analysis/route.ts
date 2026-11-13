export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";

/**
 * Item analysis: difficulty (share correct), discrimination (how well a question separates strong and
 * weak students, recomputed nightly), and flags for questions that need review.
 */
export const GET = handle(async () => {
  await requireRole("ADMIN");
  const qs = await prisma.question.findMany({
    where: { status: "LIVE" },
    select: { id: true, type: true, subject: true, topic: true, text: true, difficulty: true, timesSeen: true, timesRight: true, discrimination: true, secure: true, _count: { select: { reports: { where: { resolved: false } } } } },
  });
  const rows = qs.map((q) => {
    const p = q.timesSeen ? q.timesRight / q.timesSeen : null;
    const flags: string[] = [];
    if (q._count.reports) flags.push("Reported by students");
    if (q.timesSeen >= 30 && p! < 0.2) flags.push("Too hard or wrong key");
    if (q.timesSeen >= 30 && p! > 0.95) flags.push("Too easy");
    if (q.discrimination != null && q.discrimination < 0.1) flags.push("Does not separate strong and weak students");
    if (q.discrimination != null && q.discrimination < 0) flags.push("Strong students get it wrong more often");
    return { id: q.id, type: q.type, subject: q.subject, topic: q.topic, text: q.text.slice(0, 140), labelledDifficulty: q.difficulty, seen: q.timesSeen, pCorrect: p == null ? null : Math.round(p * 100), discrimination: q.discrimination, reports: q._count.reports, secure: q.secure, flags };
  });
  return { rows: rows.sort((a, b) => b.flags.length - a.flags.length || (a.pCorrect ?? 101) - (b.pCorrect ?? 101)) };
});
