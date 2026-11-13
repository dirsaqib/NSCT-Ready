export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";

/** Full audit log with filters: who did what, and when. */
export const GET = handle(async (req: Request) => {
  await requireRole("ADMIN");
  const f = z.object({ actorId: z.string().optional(), action: z.string().optional(), target: z.string().optional(), from: z.string().optional(), page: z.coerce.number().int().min(0).default(0) }).parse(Object.fromEntries(new URL(req.url).searchParams));
  const where = {
    ...(f.actorId ? { actorId: f.actorId } : {}),
    ...(f.action ? { action: { startsWith: f.action } } : {}),
    ...(f.target ? { target: f.target } : {}),
    ...(f.from ? { createdAt: { gte: new Date(f.from) } } : {}),
  };
  const [total, rows] = await Promise.all([prisma.auditLog.count({ where }), prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: f.page * 200, take: 200 })]);
  const actors = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.actorId))] } }, select: { id: true, email: true, role: true, profile: { select: { fullName: true } } } });
  return { total, rows: rows.map((r) => ({ ...r, actor: actors.find((a) => a.id === r.actorId) ?? null })) };
});
