export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";

/** National mock windows open now or coming up, for the student's university or for everyone. */
export const GET = handle(async () => {
  const u = await requireUser();
  const now = new Date();
  const windows = await prisma.testWindow.findMany({
    where: { closesAt: { gte: now }, OR: [{ universityId: null }, { universityId: u.universityId ?? "-" }] },
    orderBy: { opensAt: "asc" }, take: 5,
  });
  const taken = await prisma.attempt.findMany({ where: { userId: u.id, windowId: { in: windows.map((w) => w.id) } }, select: { windowId: true } });
  return { windows: windows.map((w) => ({ id: w.id, name: w.name, opensAt: w.opensAt, closesAt: w.closesAt, open: w.opensAt <= now, taken: taken.some((t) => t.windowId === w.id) })) };
});
