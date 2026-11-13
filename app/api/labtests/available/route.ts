export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { rosterWhere } from "@/lib/labtests";

/** Lab tests a student is listed for, live now or coming in the next 14 days. */
export const GET = handle(async () => {
  const u = await requireUser();
  const p = await prisma.profile.findUnique({ where: { userId: u.id } });
  if (!p) return { tests: [] };
  const now = new Date();
  const candidates = await prisma.labTest.findMany({
    where: { universityId: p.universityId, status: { not: "CLOSED" }, closesAt: { gte: now }, opensAt: { lte: new Date(now.getTime() + 14 * 86400000) } },
    orderBy: { opensAt: "asc" },
  });
  const mine = [];
  for (const t of candidates) {
    if (!(await prisma.profile.count({ where: { userId: u.id, ...rosterWhere(t) } }))) continue;
    const taken = await prisma.attempt.findFirst({ where: { userId: u.id, labTestId: t.id }, select: { id: true, submittedAt: true } });
    mine.push({ id: t.id, title: t.title, mode: t.mode, status: t.status, opensAt: t.opensAt, closesAt: t.closesAt, durationMin: t.durationMin + t.extraMin, attemptId: taken?.id ?? null, submitted: !!taken?.submittedAt });
  }
  return { tests: mine };
});
