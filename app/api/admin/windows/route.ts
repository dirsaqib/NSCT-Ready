import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

/** Scheduled test windows (national mocks). Everyone can see the schedule. */
export const GET = handle(async () => {
  await requireUser({ allowWithout2fa: true });
  return { windows: await prisma.testWindow.findMany({ where: { closesAt: { gte: new Date(Date.now() - 30 * 86400000) } }, orderBy: { opensAt: "asc" } }) };
});

export const POST = handle(async (req: Request) => {
  const u = await requireRole("ADMIN");
  const b = z.object({ name: z.string().min(3).max(100), blueprintKey: z.string().default("NATIONAL_MOCK"), opensAt: z.string().datetime(), closesAt: z.string().datetime(), universityId: z.string().nullable().optional(), announce: z.boolean().default(true) }).parse(await req.json());
  if (new Date(b.closesAt) <= new Date(b.opensAt)) throw new HttpError(400, "The window must close after it opens.");
  const w = await prisma.testWindow.create({ data: { name: b.name, blueprintKey: b.blueprintKey, opensAt: new Date(b.opensAt), closesAt: new Date(b.closesAt), universityId: b.universityId ?? null } });
  if (b.announce) {
    const students = await prisma.profile.findMany({ where: b.universityId ? { universityId: b.universityId } : {}, select: { userId: true } });
    const when = new Date(b.opensAt).toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" });
    await notify(students.map((s) => s.userId), `${b.name} is scheduled`, `It opens on ${when}. One attempt per student.`, ["EMAIL", "WHATSAPP"], "/mock");
  }
  await audit(u.id, "window.create", w.id);
  return { window: w };
});

export const DELETE = handle(async (req: Request) => {
  const u = await requireRole("ADMIN");
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  await prisma.testWindow.delete({ where: { id } });
  await audit(u.id, "window.delete", id);
  return { ok: true };
});
