export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { notify } from "@/lib/notify";

/** Support tickets. Everyone can open one. The super admin sees all tickets. */
export const GET = handle(async (req: Request) => {
  const u = await requireUser({ allowWithout2fa: true });
  const status = new URL(req.url).searchParams.get("status");
  const where = u.role === "ADMIN" ? (status ? { status: status as "OPEN" | "ANSWERED" | "CLOSED" } : {}) : { userId: u.id };
  const tickets = await prisma.ticket.findMany({
    where, orderBy: { updatedAt: "desc" }, take: 200,
    include: { user: { select: { email: true, phone: true, role: true, profile: { select: { fullName: true } } } }, _count: { select: { messages: true } } },
  });
  return { tickets };
});

export const POST = handle(async (req: Request) => {
  const u = await requireUser({ allowWithout2fa: true });
  const b = z.object({ category: z.enum(["account", "test", "payment", "question", "university", "other"]), subject: z.string().trim().min(3).max(150), body: z.string().trim().min(5).max(5000) }).parse(await req.json());
  const t = await prisma.ticket.create({ data: { userId: u.id, category: b.category, subject: b.subject, messages: { create: { userId: u.id, body: b.body } } } });
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await notify(admins.map((a) => a.id), "New support ticket", b.subject, ["EMAIL"], `/admin/support/${t.id}`);
  return { ticket: t };
});
