// Always read fresh from the database, never a copy saved at build time.
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Health check for the load balancer and uptime monitor. */
export async function GET() {
  const t = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", dbMs: Date.now() - t, version: process.env.APP_VERSION ?? "dev" });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
