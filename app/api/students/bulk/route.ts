export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, profileScope } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";

const Body = z.object({ ids: z.array(z.string()).min(1).max(2000), action: z.enum(["remove", "deactivate", "activate"]) });

/**
 * Acts on many students at once, only within the caller's own scope.
 * remove: the super admin deletes permanently. Focal persons delete students who never practised and
 * deactivate the rest, so no student's work is lost by mistake.
 */
export const POST = handle(async (req: Request) => {
  const u = await requireRole("CAMPUS_ADMIN");
  const b = Body.parse(await req.json());
  const scope = profileScope(u);
  const mine = await prisma.profile.findMany({ where: { ...scope, userId: { in: b.ids } }, select: { userId: true, user: { select: { role: true, _count: { select: { attempts: true } } } } } });
  const ids = mine.filter((p) => p.user.role === "STUDENT").map((p) => p.userId);
  if (b.action !== "remove") {
    const r = await prisma.user.updateMany({ where: { id: { in: ids } }, data: { status: b.action === "deactivate" ? "BLOCKED" : "ACTIVE" } });
    await audit(u.id, `students.bulk.${b.action}`, null, { count: r.count });
    return { changed: r.count };
  }
  const del = u.role === "ADMIN" ? ids : mine.filter((p) => p.user.role === "STUDENT" && p.user._count.attempts === 0).map((p) => p.userId);
  const keep = ids.filter((id) => !del.includes(id));
  let removed = 0;
  for (let i = 0; i < del.length; i += 200) removed += (await prisma.user.deleteMany({ where: { id: { in: del.slice(i, i + 200) } } })).count;
  if (keep.length) await prisma.user.updateMany({ where: { id: { in: keep } }, data: { status: "BLOCKED" } });
  await audit(u.id, "students.bulk.remove", null, { removed, deactivated: keep.length });
  return { removed, deactivated: keep.length };
});
