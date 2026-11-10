import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { hasPro, quote, referralCodeFor } from "@/lib/payments";

/** Prices, current Pro status, the student's referral code, and payment history with invoices. */
export const GET = handle(async (req: Request) => {
  const u = await requireUser();
  const sp = new URL(req.url).searchParams;
  const months = z.coerce.number().pipe(z.union([z.literal(1), z.literal(3)])).catch(1).parse(sp.get("months") ?? 1) as 1 | 3;
  const [q1, q3, me, payments, pro, ref] = await Promise.all([
    quote(1, sp.get("code") || undefined).catch((e) => ({ error: (e as Error).message })),
    quote(3, sp.get("code") || undefined).catch((e) => ({ error: (e as Error).message })),
    prisma.user.findUnique({ where: { id: u.id }, select: { proUntil: true } }),
    prisma.payment.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, include: { invoice: true } }),
    hasPro(u.id),
    referralCodeFor(u.id),
  ]);
  return { months, oneMonth: q1, threeMonths: q3, pro, proUntil: me?.proUntil, referralCode: ref, payments };
});
