import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { SubjectEnum } from "@/lib/questions";

/** Doubts and discussion. Faculty answers are marked as instructor answers. */
export const GET = handle(async (req: Request) => {
  await requireUser();
  const sp = new URL(req.url).searchParams;
  const subject = SubjectEnum.optional().parse(sp.get("subject") || undefined);
  const unanswered = sp.get("unanswered") === "1";
  const threads = await prisma.thread.findMany({
    where: { ...(subject ? { subject } : {}), ...(unanswered ? { posts: { none: { isInstructor: true } } } : {}) },
    orderBy: { createdAt: "desc" }, take: 100,
    include: { user: { select: { profile: { select: { alias: true, fullName: true } } } }, _count: { select: { posts: true } }, posts: { where: { isInstructor: true }, select: { id: true }, take: 1 } },
  });
  return {
    threads: threads.map((t) => ({ id: t.id, subject: t.subject, topic: t.topic, title: t.title, resolved: t.resolved, createdAt: t.createdAt, replies: t._count.posts, answered: t.posts.length > 0, by: t.user.profile?.alias || t.user.profile?.fullName?.split(" ")[0] || "Student" })),
  };
});

export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const b = z.object({ subject: SubjectEnum, topic: z.string().max(60).optional(), questionId: z.string().optional(), title: z.string().trim().min(5).max(150), body: z.string().trim().min(5).max(5000) }).parse(await req.json());
  return { thread: await prisma.thread.create({ data: { ...b, userId: u.id } }) };
});
