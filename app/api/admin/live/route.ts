export const dynamic = "force-dynamic";
import os from "node:os";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";

/** Live activity: users online in the last 5 minutes, tests in progress, queue and system load. */
export const GET = handle(async () => {
  await requireRole("ADMIN");
  const five = new Date(Date.now() - 5 * 60000);
  const [online, inProgress, byType, queued, failed] = await Promise.all([
    prisma.user.count({ where: { lastSeenAt: { gte: five } } }),
    prisma.attempt.count({ where: { submittedAt: null, startedAt: { gte: new Date(Date.now() - 3 * 3600000) }, lastSavedAt: { gte: five } } }),
    prisma.attempt.groupBy({ by: ["type"], where: { submittedAt: null, lastSavedAt: { gte: five } }, _count: true }),
    prisma.notification.count({ where: { status: "QUEUED" } }),
    prisma.notification.count({ where: { status: "FAILED", createdAt: { gte: new Date(Date.now() - 86400000) } } }),
  ]);
  const dbStart = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const dbMs = Date.now() - dbStart;
  return {
    at: new Date(), online, testsInProgress: inProgress, inProgressByType: byType.map((x) => ({ type: x.type, n: x._count })),
    notifications: { queued, failedLast24h: failed },
    system: { load1: os.loadavg()[0], cpus: os.cpus().length, memUsedPct: Math.round(100 * (1 - os.freemem() / os.totalmem())), uptimeHours: Math.round(process.uptime() / 3600), dbLatencyMs: dbMs },
  };
});
