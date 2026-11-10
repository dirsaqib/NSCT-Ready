import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";

const Body = z.object({ nsctScore: z.number().int().min(0).max(100) });

/** Optional: after official results, students share their real score. Used to measure prediction accuracy. */
export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const b = Body.parse(await req.json());
  const p = await prisma.profile.findUnique({ where: { userId: u.id }, select: { readiness: true } });
  await prisma.actualResult.upsert({
    where: { userId: u.id },
    create: { userId: u.id, nsctScore: b.nsctScore, readinessAtTest: p?.readiness ?? 0 },
    update: { nsctScore: b.nsctScore },
  });
  return { ok: true };
});
