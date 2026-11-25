export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { handle } from "@/lib/http";

/**
 * Starts the clock when the student presses Start, so time spent reading the instructions is not lost.
 * Only works once (a page refresh after Start never resets it), before any answer or autosave, and within 30 minutes of opening the test.
 */
export const POST = handle(async (_req: Request, ctx: { params: { id: string } }) => {
  const u = await requireUser();
  const a = await prisma.attempt.findUnique({ where: { id: ctx.params.id }, select: { id: true, userId: true, startedAt: true, endsAt: true, submittedAt: true, lastSavedAt: true, items: { where: { NOT: { chosen: { isEmpty: true } } }, select: { id: true }, take: 1 } } });
  if (!a || a.userId !== u.id) throw new HttpError(404, "Test not found.");
  if (a.submittedAt || !a.endsAt) return { endsAt: a.endsAt };
  const now = Date.now();
  if (a.items.length || a.lastSavedAt || now - a.startedAt.getTime() > 30 * 60000) return { endsAt: a.endsAt };
  const duration = a.endsAt.getTime() - a.startedAt.getTime();
  const upd = await prisma.attempt.update({ where: { id: a.id }, data: { startedAt: new Date(now), endsAt: new Date(now + duration) }, select: { endsAt: true } });
  return { endsAt: upd.endsAt };
});
