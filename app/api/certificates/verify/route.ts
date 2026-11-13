export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { verifyCertificate } from "@/lib/certificates";

/** Employer API: GET /api/certificates/verify?code=NR-XXXX-XXXX with header X-API-Key. */
export async function GET(req: Request) {
  const key = req.headers.get("x-api-key");
  const emp = key ? await prisma.employer.findFirst({ where: { apiKeyHash: sha256(key), verified: true } }) : null;
  if (!emp) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  const code = new URL(req.url).searchParams.get("code")?.toUpperCase() ?? "";
  const c = await verifyCertificate(code);
  await prisma.auditLog.create({ data: { actorId: emp.id, action: "certificate.api.verify", target: code } });
  return c ? NextResponse.json(c) : NextResponse.json({ valid: false }, { status: 404 });
}
