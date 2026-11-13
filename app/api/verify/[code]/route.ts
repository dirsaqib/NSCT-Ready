export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { verifyCertificate } from "@/lib/certificates";

/** Public certificate check used by the QR code. No sign-in needed. */
export async function GET(_req: Request, ctx: { params: { code: string } }) {
  const c = await verifyCertificate(ctx.params.code.toUpperCase());
  if (!c) return NextResponse.json({ valid: false }, { status: 404 });
  return NextResponse.json(c);
}
