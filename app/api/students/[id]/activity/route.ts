export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { requireRole, profileScope, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { activity } from "@/lib/student";

/** A student's preparation log for their focal person (own university only) or the super admin. */
export const GET = handle(async (_req: Request, ctx: { params: { id: string } }) => {
  const u = await requireRole("HOD");
  const p = await prisma.profile.findFirst({ where: { userId: ctx.params.id, ...profileScope(u) }, select: { userId: true } });
  if (!p) throw new HttpError(404, "Student not found.");
  return activity(p.userId);
});
