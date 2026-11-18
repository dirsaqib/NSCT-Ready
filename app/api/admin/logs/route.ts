export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";

/** System health for the super admin: errors, sign-ins, lockouts and queues, so problems are seen early. */
export const GET = handle(async (req: Request) => {
  await requireRole("ADMIN");
  const sp = new URL(req.url).searchParams;
  const view = sp.get("view") || "health";
  const day = new Date(Date.now() - 86400000);
  if (view === "errors") {
    const rows = await prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
    return { rows };
  }
  if (view === "signins") {
    const rows = await prisma.auditLog.findMany({ where: { action: { startsWith: sp.get("fail") ? "signin.fail" : "signin" } }, orderBy: { createdAt: "desc" }, take: 300 });
    const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.actorId))] } }, select: { id: true, email: true, role: true, name: true, profile: { select: { rollNumber: true } } } });
    return { rows: rows.map((r) => ({ ...r, actor: users.find((x) => x.id === r.actorId) ?? null })) };
  }
  const [errors24, errorsByPath, signinOk, signinFail, locked, pendingStudents, pendingFocals, mustChange, queued, failedNotices, users, attempts24] = await Promise.all([
    prisma.errorLog.count({ where: { createdAt: { gte: day } } }),
    prisma.errorLog.groupBy({ by: ["path"], where: { createdAt: { gte: day } }, _count: true, orderBy: { _count: { path: "desc" } }, take: 8 }),
    prisma.auditLog.count({ where: { action: "signin.ok", createdAt: { gte: day } } }),
    prisma.auditLog.count({ where: { action: "signin.fail", createdAt: { gte: day } } }),
    prisma.user.findMany({ where: { lockedUntil: { gt: new Date() } }, select: { id: true, email: true, name: true, role: true, lockedUntil: true }, take: 50 }),
    prisma.user.count({ where: { role: "STUDENT", status: "PENDING" } }),
    prisma.user.count({ where: { role: "FOCAL", status: "PENDING" } }),
    prisma.user.count({ where: { mustChangePassword: true } }),
    prisma.notification.count({ where: { status: "QUEUED" } }),
    prisma.notification.count({ where: { status: "FAILED", createdAt: { gte: day } } }).catch(() => 0),
    prisma.user.groupBy({ by: ["role", "status"], _count: true }),
    prisma.attempt.count({ where: { startedAt: { gte: day } } }),
  ]);
  return { errors24, errorsByPath, signinOk, signinFail, locked, pendingStudents, pendingFocals, mustChange, queued, failedNotices, users, attempts24 };
});

/** Unlock an account or clear old error logs. */
export const POST = handle(async (req: Request) => {
  const u = await requireRole("ADMIN");
  const b = (await req.json()) as { action: string; id?: string };
  if (b.action === "unlock" && b.id) await prisma.user.update({ where: { id: b.id }, data: { lockedUntil: null, failedLogins: 0 } });
  if (b.action === "clearErrors") await prisma.errorLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 86400000) } } });
  await prisma.auditLog.create({ data: { actorId: u.id, action: `logs.${b.action}`, target: b.id ?? null } });
  return { ok: true };
});
