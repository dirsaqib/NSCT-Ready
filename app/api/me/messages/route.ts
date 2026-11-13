export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";

/** Messages from employers to a student who opted in to the talent pool. Students can reply. */
export const GET = handle(async () => {
  const u = await requireUser();
  const msgs = await prisma.employerMessage.findMany({
    where: { OR: [{ toId: u.id }, { fromId: u.id }] }, orderBy: { createdAt: "desc" }, take: 200,
    include: { employer: { select: { name: true, verified: true } } },
  });
  return { messages: msgs };
});

export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const b = z.object({ employerId: z.string(), toId: z.string(), body: z.string().trim().min(1).max(2000) }).parse(await req.json());
  const thread = await prisma.employerMessage.findFirst({ where: { employerId: b.employerId, toId: u.id, fromId: b.toId } });
  if (!thread) throw new HttpError(403, "You can only reply to employers who contacted you.");
  return { message: await prisma.employerMessage.create({ data: { employerId: b.employerId, fromId: u.id, toId: b.toId, body: b.body } }) };
});
