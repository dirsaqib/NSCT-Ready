export const dynamic = "force-dynamic";
import { sponsorImpact } from "@/lib/sponsor";
import { requireAnyRole } from "@/lib/auth";
import { handle } from "@/lib/http";

/**
 * Sponsor dashboard: sponsored seats and universities, usage, and improvement of sponsored students
 * (first test versus latest). Aggregates only, no individual student data.
 */
export const GET = handle(async (req: Request) => {
  const u = await requireAnyRole(["SPONSOR", "ADMIN"]);
  const asked = new URL(req.url).searchParams.get("sponsorId");
  return sponsorImpact((u.role === "ADMIN" && asked) || u.sponsorId || "-");
});
