export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { hashPassword, verifyPassword, passwordProblem } from "@/lib/password";

/** Change your own password. Also used for the forced change after a temporary password. */
export const POST = handle(async (req: Request) => {
  const u = await requireUser({ allowWithout2fa: true, allowPasswordChange: true });
  const b = z.object({ current: z.string(), next: z.string() }).parse(await req.json());
  const user = await prisma.user.findUnique({ where: { id: u.id }, select: { passwordHash: true } });
  if (!verifyPassword(b.current, user?.passwordHash)) throw new HttpError(400, "Your current password is not correct.");
  const bad = passwordProblem(b.next);
  if (bad) throw new HttpError(400, bad);
  if (b.next === b.current) throw new HttpError(400, "Choose a password different from the current one.");
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: hashPassword(b.next), mustChangePassword: false } });
  await audit(u.id, "password.change");
  return { ok: true };
});
