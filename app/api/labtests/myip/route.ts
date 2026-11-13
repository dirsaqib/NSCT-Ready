export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/auth";
import { clientIp } from "@/lib/audit";
import { handle } from "@/lib/http";

/** The public address this request came from. Open it from a lab PC to fill the lab network lock. */
export const GET = handle(async () => { await requireRole("HOD"); return { ip: clientIp() }; });
