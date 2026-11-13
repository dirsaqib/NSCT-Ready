export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAnyRole, requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import { buildSnapshot } from "@/lib/reports";

/** HEC and government read published snapshots only. */
export const GET = handle(async () => {
  await requireAnyRole(["GOV", "ADMIN"]);
  const rows = await prisma.reportSnapshot.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return { snapshots: rows.map((r) => ({ id: r.id, createdAt: r.createdAt, minGroup: r.minGroup, data: r.data })) };
});

/** Super admin publishes a new anonymised snapshot. Minimum group is 20 unless piloting. */
export const POST = handle(async (req: Request) => {
  const u = await requireRole("ADMIN");
  const { minGroup } = z.object({ minGroup: z.number().int().min(5).max(100).default(20) }).parse(await req.json());
  const data = await buildSnapshot(minGroup);
  const s = await prisma.reportSnapshot.create({ data: { createdById: u.id, minGroup, data } });
  await prisma.auditLog.create({ data: { actorId: u.id, action: "report.publish", target: s.id } });
  return { id: s.id };
});
