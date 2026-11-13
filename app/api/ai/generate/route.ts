export const dynamic = "force-dynamic";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import { generateQuestions, useQuota } from "@/lib/ai";

const Body = z.object({
  subject: z.enum(["PS", "PROG", "DSA", "DB", "SE", "WEB", "AI", "NET", "OS", "SEC"]),
  topic: z.string().max(60).optional(),
  count: z.number().int().min(1).max(10).default(5),
});

/** Faculty only. Returns drafts. Nothing is saved until a faculty member submits them for review. */
export const POST = handle(async (req: Request) => {
  const u = await requireRole("FACULTY");
  const b = Body.parse(await req.json());
  await useQuota(u.id, 3);
  return { drafts: await generateQuestions(b.subject, b.topic, b.count) };
});
