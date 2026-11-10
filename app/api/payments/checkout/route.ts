import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { startCheckout } from "@/lib/payments";
import { audit } from "@/lib/audit";

export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const b = z.object({
    method: z.enum(["JAZZCASH", "EASYPAISA", "CARD"]),
    months: z.union([z.literal(1), z.literal(3)]),
    discountCode: z.string().max(30).optional(),
    referralCode: z.string().max(30).optional(),
  }).parse(await req.json());
  const r = await startCheckout(u.id, b.method, b.months, b.discountCode || undefined, b.referralCode || undefined);
  await audit(u.id, "payment.start", r.paymentId, { method: b.method, amount: r.amount });
  return r;
});
