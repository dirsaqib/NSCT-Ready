export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";

/** Withdraw a published snapshot. */
export const DELETE = handle(async (_req: Request, ctx: { params: { id: string } }) => {
  const u = await requireRole("ADMIN");
  await prisma.reportSnapshot.delete({ where: { id: ctx.params.id } });
  await prisma.auditLog.create({ data: { actorId: u.id, action: "report.withdraw", target: ctx.params.id } });
  return { ok: true };
});
