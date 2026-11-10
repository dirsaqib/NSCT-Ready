// Pro access payments for students without university access: JazzCash (wallet and card) and Easypaisa.
// Both use hosted checkout pages: we build a signed form, the browser posts it to the gateway, and the
// gateway posts the result back to our callback. Field names follow the public merchant integration
// guides. Test every flow in each gateway's sandbox with your merchant credentials before going live.
import { createCipheriv, createHmac } from "node:crypto";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "./db";
import { HttpError } from "./errors";
import { getSetting } from "./settings";
import { publicCode } from "./crypto";

const ts = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${g("year")}${g("month")}${g("day")}${g("hour")}${g("minute")}${g("second")}`;
};

export async function quote(months: 1 | 3, discountCode?: string) {
  const base = months === 1 ? await getSetting<number>("pricing.proMonthlyPkr") : await getSetting<number>("pricing.proThreeMonthPkr");
  let percentOff = 0;
  if (discountCode) {
    const d = await prisma.discountCode.findUnique({ where: { code: discountCode.toUpperCase() } });
    if (!d || !d.active || d.used >= d.maxUses || (d.expiresAt && d.expiresAt < new Date())) throw new HttpError(400, "This discount code is not valid.");
    percentOff = d.percentOff;
  }
  return { base, percentOff, total: Math.max(0, Math.round(base * (1 - percentOff / 100))) };
}

// ---------- JazzCash ----------
function jazzHash(fields: Record<string, string>) {
  const salt = process.env.JAZZCASH_INTEGRITY_SALT ?? "";
  const values = Object.keys(fields).filter((k) => k.startsWith("pp_") && k !== "pp_SecureHash" && fields[k] !== "").sort().map((k) => fields[k]);
  return createHmac("sha256", salt).update([salt, ...values].join("&")).digest("hex").toUpperCase();
}

function jazzForm(paymentId: string, amountPkr: number, card: boolean) {
  const now = new Date();
  const f: Record<string, string> = {
    pp_Version: "1.1",
    pp_TxnType: card ? "" : "MWALLET",
    pp_Language: "EN",
    pp_MerchantID: process.env.JAZZCASH_MERCHANT_ID ?? "",
    pp_Password: process.env.JAZZCASH_PASSWORD ?? "",
    pp_TxnRefNo: `T${ts(now)}${paymentId.slice(-6)}`,
    pp_Amount: String(amountPkr * 100), // paisa
    pp_TxnCurrency: "PKR",
    pp_TxnDateTime: ts(now),
    pp_BillReference: paymentId,
    pp_Description: "NSCT Ready Pro access",
    pp_TxnExpiryDateTime: ts(new Date(now.getTime() + 3600000)),
    pp_ReturnURL: `${process.env.NEXTAUTH_URL}/api/payments/callback/jazzcash`,
  };
  f.pp_SecureHash = jazzHash(f);
  return { action: process.env.JAZZCASH_URL ?? "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/", fields: f, ref: f.pp_TxnRefNo };
}

export function verifyJazzCallback(body: Record<string, string>) {
  return body.pp_SecureHash === jazzHash(body) ? { ok: body.pp_ResponseCode === "000", ref: body.pp_TxnRefNo, billRef: body.pp_BillReference } : null;
}

// ---------- Easypaisa ----------
function easypaisaForm(paymentId: string, amountPkr: number) {
  const params: Record<string, string> = {
    amount: amountPkr.toFixed(1),
    orderRefNum: paymentId,
    paymentMethod: "MA_PAYMENT_METHOD",
    postBackURL: `${process.env.NEXTAUTH_URL}/api/payments/callback/easypaisa`,
    storeId: process.env.EASYPAISA_STORE_ID ?? "",
    timeStamp: new Date().toISOString().slice(0, 19),
  };
  const plain = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  const key = Buffer.from(process.env.EASYPAISA_HASH_KEY ?? "".padEnd(16, "0")).subarray(0, 16);
  const c = createCipheriv("aes-128-ecb", key, null);
  const merchantHashedReq = Buffer.concat([c.update(plain, "utf8"), c.final()]).toString("base64");
  return { action: process.env.EASYPAISA_URL ?? "https://easypaystg.easypaisa.com.pk/easypay/Index.jsf", fields: { ...params, merchantHashedReq }, ref: paymentId };
}

/** Start a checkout. Returns a form for the browser to post to the gateway. */
export async function startCheckout(userId: string, method: PaymentMethod, months: 1 | 3, discountCode?: string, referralCode?: string) {
  const q = await quote(months, discountCode);
  if (q.total === 0) throw new HttpError(400, "Use the free activation for a 100% discount.");
  const p = await prisma.payment.create({ data: { userId, method, amountPkr: q.total, months, discountCode: discountCode?.toUpperCase(), referralCode } });
  const form = method === "EASYPAISA" ? easypaisaForm(p.id, q.total) : jazzForm(p.id, q.total, method === "CARD");
  await prisma.payment.update({ where: { id: p.id }, data: { gatewayRef: form.ref } });
  return { paymentId: p.id, amount: q.total, ...form };
}

/** Mark paid once, extend Pro, count codes and issue the invoice. Safe to call twice. */
export async function markPaid(paymentId: string, raw: unknown) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, include: { user: true } });
  if (!p || p.status === "PAID") return p;
  const from = p.user.proUntil && p.user.proUntil > new Date() ? p.user.proUntil : new Date();
  const until = new Date(from.getTime() + p.months * 30 * 86400000);
  const count = await prisma.invoice.count();
  await prisma.$transaction([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.payment.update({ where: { id: p.id }, data: { status: "PAID", paidAt: new Date(), gatewayRaw: raw as any } }),
    prisma.user.update({ where: { id: p.userId }, data: { proUntil: until } }),
    prisma.invoice.create({
      data: {
        number: `INV-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`,
        paymentId: p.id,
        billTo: p.user.name || p.user.email || p.user.phone || p.userId,
        lines: [{ item: `NSCT Ready Pro, ${p.months} month(s)`, amountPkr: p.amountPkr }],
        totalPkr: p.amountPkr,
      },
    }),
    ...(p.discountCode ? [prisma.discountCode.update({ where: { code: p.discountCode }, data: { used: { increment: 1 } } })] : []),
  ]);
  if (p.referralCode) {
    const r = await prisma.referral.findUnique({ where: { code: p.referralCode } });
    if (r && r.ownerId !== p.userId) {
      const owner = await prisma.user.findUnique({ where: { id: r.ownerId } });
      const base = owner?.proUntil && owner.proUntil > new Date() ? owner.proUntil : new Date();
      await prisma.$transaction([
        prisma.referral.update({ where: { code: r.code }, data: { uses: { increment: 1 } } }),
        prisma.user.update({ where: { id: r.ownerId }, data: { proUntil: new Date(base.getTime() + r.rewardDays * 86400000) } }),
      ]);
    }
  }
  return p;
}

export async function referralCodeFor(userId: string) {
  const r = await prisma.referral.findUnique({ where: { ownerId: userId } });
  if (r) return r.code;
  const code = publicCode("REF");
  await prisma.referral.create({ data: { code, ownerId: userId } });
  return code;
}

/** Pro access: university plan, a sponsored seat, or a paid individual subscription. */
export async function hasPro(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { proUntil: true, universityId: true, status: true } });
  if (!u) return false;
  if (u.proUntil && u.proUntil > new Date()) return true;
  if (u.universityId && u.status !== "PENDING") {
    const plan = await prisma.universityPlan.findFirst({ where: { universityId: u.universityId, active: true, renewsAt: { gt: new Date() } } });
    if (plan) return true;
    const seat = await prisma.sponsorship.findFirst({ where: { universityId: u.universityId, endsAt: { gt: new Date() } } });
    if (seat) return true;
  }
  return false;
}
