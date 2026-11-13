export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";

export const GET = handle(async (_req: Request, ctx: { params: { id: string } }) => {
  await requireRole("ADMIN");
  return { versions: await prisma.questionVersion.findMany({ where: { questionId: ctx.params.id }, orderBy: { version: "desc" } }) };
});
