export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { notify } from "@/lib/notify";

async function load(id: string, userId: string, admin: boolean) {
  const t = await prisma.ticket.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!t || (!admin && t.userId !== userId)) throw new HttpError(404, "Ticket not found.");
  return t;
}

export const GET = handle(async (_req: Request, ctx: { params: { id: string } }) => {
  const u = await requireUser({ allowWithout2fa: true });
  return { ticket: await load(ctx.params.id, u.id, u.role === "ADMIN") };
});

export const POST = handle(async (req: Request, ctx: { params: { id: string } }) => {
  const u = await requireUser({ allowWithout2fa: true });
  const admin = u.role === "ADMIN";
  const t = await load(ctx.params.id, u.id, admin);
  const { body } = z.object({ body: z.string().trim().min(1).max(5000) }).parse(await req.json());
  await prisma.$transaction([
    prisma.ticketMessage.create({ data: { ticketId: t.id, userId: u.id, body, staff: admin } }),
    prisma.ticket.update({ where: { id: t.id }, data: { status: admin ? "ANSWERED" : "OPEN" } }),
  ]);
  if (admin) await notify([t.userId], "Support replied to your ticket", t.subject, ["EMAIL"], `/support/${t.id}`);
  return { ok: true };
});

export const PATCH = handle(async (req: Request, ctx: { params: { id: string } }) => {
  const u = await requireUser({ allowWithout2fa: true });
  const t = await load(ctx.params.id, u.id, u.role === "ADMIN");
  const { status } = z.object({ status: z.enum(["OPEN", "ANSWERED", "CLOSED"]) }).parse(await req.json());
  await prisma.ticket.update({ where: { id: t.id }, data: { status } });
  return { ok: true };
});
