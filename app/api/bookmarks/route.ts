import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";

export const GET = handle(async () => {
  const u = await requireUser();
  const rows = await prisma.bookmark.findMany({
    where: { userId: u.id }, orderBy: { createdAt: "desc" },
    include: { question: { select: { id: true, type: true, subject: true, topic: true, text: true, code: true, options: true, answers: true, explanation: true } } },
  });
  return { bookmarks: rows.map((r) => r.question) };
});

const B = z.object({ questionId: z.string() });

export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const { questionId } = B.parse(await req.json());
  await prisma.bookmark.upsert({ where: { userId_questionId: { userId: u.id, questionId } }, create: { userId: u.id, questionId }, update: {} });
  return { saved: true };
});

export const DELETE = handle(async (req: Request) => {
  const u = await requireUser();
  const { questionId } = B.parse(await req.json());
  await prisma.bookmark.deleteMany({ where: { userId: u.id, questionId } });
  return { saved: false };
});
