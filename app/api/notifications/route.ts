import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";

export const GET = handle(async () => {
  const u = await requireUser({ allowWithout2fa: true });
  const items = await prisma.notification.findMany({ where: { userId: u.id, channel: "IN_APP" }, orderBy: { createdAt: "desc" }, take: 50 });
  return { items, unread: items.filter((i) => i.status !== "READ").length };
});

export const PATCH = handle(async (req: Request) => {
  const u = await requireUser({ allowWithout2fa: true });
  const { ids } = z.object({ ids: z.array(z.string()).max(100).optional() }).parse(await req.json());
  await prisma.notification.updateMany({ where: { userId: u.id, channel: "IN_APP", ...(ids ? { id: { in: ids } } : {}) }, data: { status: "READ" } });
  return { ok: true };
});
