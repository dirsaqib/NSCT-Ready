export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";

/**
 * Uploads made before upload records existed are rebuilt from the audit log: students the same focal
 * person verified at the moment of the upload, whose record was created at that same moment.
 */
async function recoverOlderUploads() {
  const logs = await prisma.auditLog.findMany({ where: { action: "students.import" }, orderBy: { createdAt: "asc" }, take: 2000 });
  const pending = logs.filter((l) => !(l.meta as { batchId?: string } | null)?.batchId);
  const taken = new Set((await prisma.importBatch.findMany({ select: { createdIds: true } })).flatMap((b) => b.createdIds));
  let made = 0;
  for (const l of pending) {
    if (!l.target) continue;
    const t = l.createdAt.getTime();
    const rows = await prisma.profile.findMany({
      where: { universityId: l.target, verifiedById: l.actorId, createdAt: { gte: new Date(t - 15 * 60000), lte: new Date(t + 5000) } },
      select: { userId: true, createdAt: true, verifiedAt: true },
    });
    const ids = rows.filter((r) => r.verifiedAt && Math.abs(r.verifiedAt.getTime() - r.createdAt.getTime()) < 60000 && !taken.has(r.userId)).map((r) => r.userId);
    ids.forEach((id) => taken.add(id));
    const meta = (l.meta ?? {}) as Record<string, unknown>;
    const b = await prisma.importBatch.create({ data: { universityId: l.target, uploaderId: l.actorId, filename: "Older upload (recovered)", createdIds: ids, updatedCount: Number(meta.updated ?? 0), createdAt: l.createdAt } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.auditLog.update({ where: { id: l.id }, data: { meta: { ...meta, batchId: b.id } as any } });
    made++;
  }
  // Safety net: any student created by a university upload that still belongs to no upload record is grouped
  // by university, uploader and time, so nothing uploaded is ever missing from this page.
  const loose = await prisma.profile.findMany({ where: { verifiedById: { not: null }, verifiedAt: { not: null }, userId: { notIn: [...taken] } }, select: { userId: true, universityId: true, verifiedById: true, createdAt: true, verifiedAt: true }, orderBy: { createdAt: "asc" }, take: 20000 });
  const groups = new Map<string, { universityId: string; uploaderId: string; at: Date; ids: string[] }>();
  for (const p of loose) {
    if (Math.abs(p.verifiedAt!.getTime() - p.createdAt.getTime()) >= 60000) continue; // verified later by hand, not uploaded
    const key = `${p.universityId}|${p.verifiedById}|${Math.floor(p.createdAt.getTime() / (30 * 60000))}`;
    const g = groups.get(key) ?? { universityId: p.universityId, uploaderId: p.verifiedById!, at: p.createdAt, ids: [] };
    g.ids.push(p.userId); groups.set(key, g);
  }
  for (const g of groups.values()) {
    await prisma.importBatch.create({ data: { universityId: g.universityId, uploaderId: g.uploaderId, filename: "Older upload (recovered)", createdIds: g.ids, createdAt: g.at } });
    made++;
  }
  return made;
}

/** Every student upload on the platform, old and new, for the super admin. */
export const GET = handle(async (req: Request) => {
  await requireRole("ADMIN");
  await recoverOlderUploads();
  const sp = new URL(req.url).searchParams;
  const universityId = sp.get("universityId") || undefined;
  const page = Math.max(0, Number(sp.get("page") || 0));
  const where = universityId ? { universityId } : {};
  const [total, rows] = await Promise.all([
    prisma.importBatch.count({ where }),
    prisma.importBatch.findMany({ where, orderBy: { createdAt: "desc" }, skip: page * 100, take: 100 }),
  ]);
  const unis = await prisma.university.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.universityId))] } }, select: { id: true, name: true } });
  const people = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.uploaderId))] } }, select: { id: true, name: true, email: true } });
  const alive = await prisma.user.findMany({ where: { id: { in: rows.flatMap((r) => r.createdIds) } }, select: { id: true } });
  const live = new Set(alive.map((a) => a.id));
  const universities = await prisma.importBatch.groupBy({ by: ["universityId"], _count: true });
  const uniNames = await prisma.university.findMany({ where: { id: { in: universities.map((u) => u.universityId) } }, select: { id: true, name: true } });
  return {
    total, page,
    universities: uniNames.map((u) => ({ id: u.id, name: u.name, uploads: universities.find((x) => x.universityId === u.id)?._count ?? 0 })).sort((a, b) => a.name.localeCompare(b.name)),
    rows: rows.map((b) => ({
      id: b.id, filename: b.filename, createdAt: b.createdAt, undoneAt: b.undoneAt, updated: b.updatedCount,
      created: b.createdIds.length, stillThere: b.createdIds.filter((id) => live.has(id)).length,
      university: unis.find((u) => u.id === b.universityId)?.name ?? "Unknown",
      uploader: people.find((p) => p.id === b.uploaderId)?.name ?? people.find((p) => p.id === b.uploaderId)?.email ?? "Unknown",
    })),
  };
});

/** Deletes every student an upload created, together with their tests and progress. Super admin only. */
export const POST = handle(async (req: Request) => {
  const u = await requireRole("ADMIN");
  const { batchId } = z.object({ batchId: z.string().min(1) }).parse(await req.json());
  const b = await prisma.importBatch.findUnique({ where: { id: batchId } });
  if (!b) throw new HttpError(404, "Upload not found.");
  const ids = (await prisma.user.findMany({ where: { id: { in: b.createdIds }, role: "STUDENT" }, select: { id: true } })).map((x) => x.id);
  let removed = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const r = await prisma.user.deleteMany({ where: { id: { in: ids.slice(i, i + 200) } } });
    removed += r.count;
  }
  await prisma.importBatch.update({ where: { id: b.id }, data: { undoneAt: new Date() } });
  await audit(u.id, "students.import.delete", b.universityId, { batchId: b.id, removed });
  return { removed };
});
