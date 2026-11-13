export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { SubjectEnum } from "@/lib/questions";

/** Syllabus: short notes and video lessons by subject and topic. */
export const GET = handle(async (req: Request) => {
  await requireUser();
  const subject = SubjectEnum.optional().parse(new URL(req.url).searchParams.get("subject") || undefined);
  return { lessons: await prisma.lesson.findMany({ where: subject ? { subject } : {}, orderBy: [{ subject: "asc" }, { topic: "asc" }, { order: "asc" }] }) };
});

const Lesson = z.object({
  id: z.string().optional(), subject: SubjectEnum, topic: z.string().min(2).max(60), title: z.string().min(2).max(120),
  notes: z.string().min(10).max(20000), videoUrl: z.string().url().optional().or(z.literal("")), order: z.number().int().default(0),
});

export const POST = handle(async (req: Request) => {
  await requireRole("ADMIN");
  const { id, ...d } = Lesson.parse(await req.json());
  const data = { ...d, videoUrl: d.videoUrl || null };
  return { lesson: id ? await prisma.lesson.update({ where: { id }, data }) : await prisma.lesson.create({ data }) };
});

export const DELETE = handle(async (req: Request) => {
  await requireRole("ADMIN");
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  await prisma.lesson.delete({ where: { id } });
  return { ok: true };
});
