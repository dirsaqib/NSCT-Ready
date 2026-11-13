export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { tutorChat, useQuota } from "@/lib/ai";
import { hasPro } from "@/lib/payments";
import { getSetting } from "@/lib/settings";
import { SUBJECTS } from "@/lib/syllabus";

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).min(1).max(30),
  lang: z.enum(["English", "Urdu", "Roman Urdu"]).default("English"),
});

export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const b = Body.parse(await req.json());
  await useQuota(u.id, 1, (await hasPro(u.id)) ? undefined : await getSetting<number>("pricing.freeAiCallsPerDay"));
  const m = await prisma.mastery.findMany({ where: { userId: u.id, total: { gt: 0 } } });
  const weak = m
    .sort((a, b2) => a.correct / a.total - b2.correct / b2.total)
    .slice(0, 3)
    .map((x) => SUBJECTS.find((s) => s.key === x.subject)?.short ?? x.subject);
  const msgs = b.messages[0].role === "user" ? b.messages : b.messages.slice(1);
  return { text: await tutorChat(msgs, weak, b.lang) };
});
