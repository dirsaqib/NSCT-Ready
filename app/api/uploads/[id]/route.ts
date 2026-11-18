export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";

/** View a proof file. Allowed for its owner, the super admin, and focal persons of the owner's university. */
export const GET = handle(async (_req: Request, ctx: { params: { id: string } }) => {
  const u = await requireUser();
  const f = await prisma.upload.findUnique({ where: { id: ctx.params.id }, include: { user: { select: { id: true, universityId: true } } } });
  if (!f) throw new HttpError(404, "File not found.");
  const ok = f.userId === u.id || u.role === "ADMIN" || (["FOCAL", "CAMPUS_ADMIN"].includes(u.role) && u.universityId && u.universityId === f.user.universityId && f.kind === "ENROLLMENT_PROOF");
  if (!ok) throw new HttpError(403, "You cannot open this file.");
  if (f.userId !== u.id) await audit(u.id, "upload.view", f.id);
  return new Response(new Uint8Array(f.data), {
    headers: { "Content-Type": f.mime, "Content-Disposition": `inline; filename="${f.filename.replace(/[^\w.\- ]/g, "_")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
});
