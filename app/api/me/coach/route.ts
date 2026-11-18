export const dynamic = "force-dynamic";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { getCoach } from "@/lib/coach";
import { prisma } from "@/lib/db";
import { useQuota } from "@/lib/ai";

/** Personal coaching plan for the signed-in student, refreshed once a day. ?refresh=1 rebuilds it. */
export const GET = handle(async (req: Request) => {
  const u = await requireUser();
  if (new URL(req.url).searchParams.get("refresh")) {
    if (process.env.ANTHROPIC_API_KEY) await useQuota(u.id, 2);
    await prisma.coachAdvice.deleteMany({ where: { userId: u.id } });
  }
  const lang = u.locale === "ur" ? "Roman Urdu" : "English";
  return { coach: await getCoach(u.id, lang) };
});
