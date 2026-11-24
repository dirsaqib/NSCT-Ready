export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";

const UNDO_DAYS = 7;

/** Recent uploads for this university, newest first, so a wrong one can be undone. */
export const GET = handle(async () => {
  const u = await requireRole("CAMPUS_ADMIN");
  const where = u.role === "ADMIN" ? {} : { universityId: u.universityId ?? "-", ...(u.departmentId ? { uploaderId: u.id } : {}) };
  const rows = await prisma.importBatch.findMany({ where, orderBy: { createdAt: "desc" }, take: 15 });
  return { rows: rows.map((b) => ({ id: b.id, filename: b.filename, created: b.createdIds.length, updated: b.updatedCount, createdAt: b.createdAt, undoneAt: b.undoneAt, canUndo: !b.undoneAt && b.createdIds.length > 0 && Date.now() - b.createdAt.getTime() < UNDO_DAYS * 86400000 })) };
});

/**
 * Undo an upload: students it created are removed. Anyone who has already practised or taken a test is
 * deactivated instead, so their work is not lost. Students the upload only updated are left as they are.
 */
export const POST = handle(async (req: Request) => {
  const u = await requireRole("CAMPUS_ADMIN");
  const { batchId } = z.object({ batchId: z.string().min(1) }).parse(await req.json());
  const b = await prisma.importBatch.findUnique({ where: { id: batchId } });
  if (!b || (u.role !== "ADMIN" && (b.universityId !== u.universityId || (u.departmentId && b.uploaderId !== u.id)))) throw new HttpError(404, "Upload not found.");
  if (b.undoneAt) throw new HttpError(409, "This upload was already undone.");
  if (Date.now() - b.createdAt.getTime() > UNDO_DAYS * 86400000) throw new HttpError(400, `Uploads can be undone within ${UNDO_DAYS} days. Deactivate students one by one instead.`);

  const users = await prisma.user.findMany({ where: { id: { in: b.createdIds }, role: "STUDENT", universityId: b.universityId }, select: { id: true, _count: { select: { attempts: true } } } });
  const keep = users.filter((x) => x._count.attempts > 0).map((x) => x.id);
  const drop = users.filter((x) => x._count.attempts === 0).map((x) => x.id);
  await prisma.$transaction([
    prisma.user.deleteMany({ where: { id: { in: drop } } }),
    prisma.user.updateMany({ where: { id: { in: keep } }, data: { status: "BLOCKED" } }),
    prisma.importBatch.update({ where: { id: b.id }, data: { undoneAt: new Date() } }),
  ], { timeout: 30000 });
  await audit(u.id, "students.import.undo", b.universityId, { batchId: b.id, removed: drop.length, deactivated: keep.length });
  return { removed: drop.length, deactivated: keep.length };
});
