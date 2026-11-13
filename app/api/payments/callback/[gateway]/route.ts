export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { markPaid, verifyJazzCallback } from "@/lib/payments";

/** The payment gateway posts the result here. We verify the signature, then send the student back to the app. */
export async function POST(req: Request, ctx: { params: { gateway: string } }) {
  const form = Object.fromEntries((await req.formData()).entries()) as Record<string, string>;
  const back = (ok: boolean) => NextResponse.redirect(`${process.env.NEXTAUTH_URL}/pro?status=${ok ? "paid" : "failed"}`, 303);

  if (ctx.params.gateway === "jazzcash") {
    const v = verifyJazzCallback(form);
    if (!v) return back(false);
    const p = await prisma.payment.findFirst({ where: { gatewayRef: v.ref } });
    if (!p) return back(false);
    if (v.ok) { await markPaid(p.id, form); return back(true); }
    await prisma.payment.update({ where: { id: p.id }, data: { status: "FAILED", gatewayRaw: form } });
    return back(false);
  }

  if (ctx.params.gateway === "easypaisa") {
    // Easypaisa posts the order reference. Confirm the status with Easypaisa's inquiry API before marking paid.
    const ref = form.orderRefNumber || form.orderRefNum;
    const p = ref ? await prisma.payment.findUnique({ where: { id: ref } }) : null;
    if (!p) return back(false);
    const ok = await easypaisaInquiry(ref!);
    if (ok) { await markPaid(p.id, form); return back(true); }
    await prisma.payment.update({ where: { id: p.id }, data: { status: "FAILED", gatewayRaw: form } });
    return back(false);
  }
  return NextResponse.json({ error: "Unknown gateway" }, { status: 404 });
}

async function easypaisaInquiry(orderId: string) {
  const url = process.env.EASYPAISA_INQUIRY_URL;
  if (!url) return false;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Credentials: Buffer.from(`${process.env.EASYPAISA_USERNAME}:${process.env.EASYPAISA_PASSWORD}`).toString("base64") },
    body: JSON.stringify({ orderId, storeId: process.env.EASYPAISA_STORE_ID, accountNum: process.env.EASYPAISA_ACCOUNT_NUM }),
  });
  if (!r.ok) return false;
  const j = (await r.json()) as { responseCode?: string; transactionStatus?: string };
  return j.responseCode === "0000" && j.transactionStatus === "PAID";
}
