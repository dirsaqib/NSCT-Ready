export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { BLUEPRINTS, DURATION_SEC } from "@/lib/syllabus";

/** Test blueprints: questions per subject, difficulty mix, time limit, pass mark, negative marking. */
export const GET = handle(async () => {
  await requireRole("ADMIN");
  const saved = await prisma.blueprint.findMany();
  const defaults = Object.entries(BLUEPRINTS).filter(([k]) => !saved.some((s) => s.key === k)).map(([key, counts]) => ({
    id: null, key, name: key.replace("_", " ").toLowerCase(), counts, difficulty: null, durationMin: Math.round((DURATION_SEC[key as keyof typeof DURATION_SEC] ?? 3600) / 60), passMark: 50, negativeMarking: 0,
  }));
  return { blueprints: [...saved, ...defaults] };
});

const Subj = z.enum(["PS", "PROG", "DSA", "DB", "SE", "WEB", "AI", "NET", "OS", "SEC"]);

export const PUT = handle(async (req: Request) => {
  const u = await requireRole("ADMIN");
  const b = z.object({
    key: z.string().regex(/^[A-Z_]{3,30}$/),
    name: z.string().min(2).max(80),
    counts: z.record(Subj, z.number().int().min(0).max(100)),
    difficulty: z.record(z.enum(["1", "2", "3"]), z.number().int().min(0).max(100)).nullable().optional(),
    durationMin: z.number().int().min(5).max(300),
    passMark: z.number().int().min(0).max(100),
    negativeMarking: z.number().min(0).max(1),
  }).parse(await req.json());
  if (b.difficulty && Object.values(b.difficulty).reduce((s, x) => s + x, 0) !== 100) throw new HttpError(400, "The difficulty mix must add up to 100%.");
  const data = { ...b, difficulty: b.difficulty ?? undefined };
  const row = await prisma.blueprint.upsert({ where: { key: b.key }, create: data, update: data });
  await audit(u.id, "blueprint.save", b.key, b);
  return { blueprint: row };
});
