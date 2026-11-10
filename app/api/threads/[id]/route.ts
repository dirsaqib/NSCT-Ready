import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { notify } from "@/lib/notify";

const INSTRUCTORS = ["FACULTY", "HOD", "CAMPUS_ADMIN", "FOCAL", "CHAIR", "ADMIN"];

export const GET = handle(async (_req: Request, ctx: { params: { id: string } }) => {
  await requireUser();
  const t = await prisma.thread.findUnique({
    where: { id: ctx.params.id },
    include: { posts: { orderBy: { createdAt: "asc" }, include: { user: { select: { role: true, profile: { select: { alias: true, fullName: true } } } } } } },
  });
  if (!t) throw new HttpError(404, "Not found.");
  return { thread: t };
});

export const POST = handle(async (req: Request, ctx: { params: { id: string } }) => {
  const u = await requireUser();
  const { body } = z.object({ body: z.string().trim().min(2).max(5000) }).parse(await req.json());
  const t = await prisma.thread.findUnique({ where: { id: ctx.params.id } });
  if (!t) throw new HttpError(404, "Not found.");
  const isInstructor = INSTRUCTORS.includes(u.role);
  const post = await prisma.post.create({ data: { threadId: t.id, userId: u.id, body, isInstructor } });
  if (t.userId !== u.id) await notify([t.userId], isInstructor ? "An instructor answered your question" : "New reply to your question", t.title, [], `/discuss/${t.id}`);
  return { post };
});

/** The author or an instructor marks the doubt as resolved. */
export const PATCH = handle(async (_req: Request, ctx: { params: { id: string } }) => {
  const u = await requireUser();
  const t = await prisma.thread.findUnique({ where: { id: ctx.params.id } });
  if (!t) throw new HttpError(404, "Not found.");
  if (t.userId !== u.id && !INSTRUCTORS.includes(u.role)) throw new HttpError(403, "Not allowed.");
  await prisma.thread.update({ where: { id: t.id }, data: { resolved: !t.resolved } });
  return { ok: true };
});
