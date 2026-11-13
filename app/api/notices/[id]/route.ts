export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { requireRole, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";

export const DELETE = handle(async (_req: Request, ctx: { params: { id: string } }) => {
  const u = await requireRole("HOD");
  const n = await prisma.notice.findUnique({ where: { id: ctx.params.id } });
  if (!n) throw new HttpError(404, "Not found.");
  if (u.role !== "ADMIN" && n.createdById !== u.id && !(u.role === "FOCAL" && n.universityId === u.universityId)) throw new HttpError(403, "Not allowed.");
  await prisma.notice.delete({ where: { id: n.id } });
  return { ok: true };
});
