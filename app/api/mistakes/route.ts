export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";

export const GET = handle(async () => {
  const u = await requireUser();
  const rows = await prisma.mistake.findMany({
    where: { userId: u.id },
    orderBy: { addedAt: "desc" },
    take: 100,
    include: { question: { select: { id: true, subject: true, topic: true, text: true, code: true, options: true, answers: true, type: true, explanation: true } } },
  });
  return { mistakes: rows.map((r) => r.question) };
});
