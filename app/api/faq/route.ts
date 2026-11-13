export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";

/** Public help centre content. */
export const GET = handle(async () => ({ faqs: await prisma.faq.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] }) }));

export const POST = handle(async (req: Request) => {
  await requireRole("ADMIN");
  const { id, ...d } = z.object({ id: z.string().optional(), category: z.string().min(2).max(40), question: z.string().min(5).max(300), answer: z.string().min(5).max(5000), order: z.number().int().default(0) }).parse(await req.json());
  return { faq: id ? await prisma.faq.update({ where: { id }, data: d }) : await prisma.faq.create({ data: d }) };
});

export const DELETE = handle(async (req: Request) => {
  await requireRole("ADMIN");
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  await prisma.faq.delete({ where: { id } });
  return { ok: true };
});
