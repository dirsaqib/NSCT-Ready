import { headers } from "next/headers";
import { prisma } from "./db";

/** Record who did what and when. Called for every write action by staff and for sensitive reads. */
export async function audit(actorId: string, action: string, target?: string | null, meta?: Record<string, unknown>) {
  let ip: string | null = null;
  try { ip = headers().get("cf-connecting-ip") || headers().get("x-forwarded-for")?.split(",")[0] || null; } catch { /* outside a request */ }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.auditLog.create({ data: { actorId, action, target: target ?? null, meta: (meta ?? undefined) as any, ip } });
}

export function clientIp() {
  try { return headers().get("cf-connecting-ip") || headers().get("x-forwarded-for")?.split(",")[0] || null; } catch { return null; }
}
