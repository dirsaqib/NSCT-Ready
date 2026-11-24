import { prisma } from "./db";

/**
 * Uploads made before upload records existed are rebuilt from the audit log: students the same focal
 * person verified at the moment of the upload, whose record was created at that same moment.
 */
export async function recoverOlderUploads(universityId?: string) {
  const logs = await prisma.auditLog.findMany({ where: { action: "students.import", ...(universityId ? { target: universityId } : {}) }, orderBy: { createdAt: "asc" }, take: 2000 });
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
  const loose = await prisma.profile.findMany({ where: { ...(universityId ? { universityId } : {}), verifiedById: { not: null }, verifiedAt: { not: null }, userId: { notIn: [...taken] } }, select: { userId: true, universityId: true, verifiedById: true, createdAt: true, verifiedAt: true }, orderBy: { createdAt: "asc" }, take: 20000 });
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

