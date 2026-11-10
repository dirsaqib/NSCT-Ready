import QRCode from "qrcode";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, HttpError, TWO_FACTOR_ROLES } from "@/lib/auth";
import { handle } from "@/lib/http";
import { newSecret, otpauthUrl, verifyTotp } from "@/lib/totp";
import { decrypt, encrypt } from "@/lib/crypto";
import { audit } from "@/lib/audit";

/** Start setup: a new secret and a QR code for the authenticator app. Not active until confirmed. */
export const GET = handle(async () => {
  const u = await requireUser({ allowWithout2fa: true });
  const db = await prisma.user.findUnique({ where: { id: u.id }, select: { totpEnabled: true, email: true, phone: true } });
  if (db?.totpEnabled) return { enabled: true };
  const secret = newSecret();
  await prisma.user.update({ where: { id: u.id }, data: { totpSecret: encrypt(secret) } });
  const url = otpauthUrl(secret, db?.email || db?.phone || u.id);
  return { enabled: false, secret, qr: await QRCode.toDataURL(url) };
});

/** Confirm setup with the first code from the app. */
export const POST = handle(async (req: Request) => {
  const u = await requireUser({ allowWithout2fa: true });
  const { code } = z.object({ code: z.string().min(6).max(8) }).parse(await req.json());
  const db = await prisma.user.findUnique({ where: { id: u.id }, select: { totpSecret: true } });
  if (!db?.totpSecret || !verifyTotp(decrypt(db.totpSecret), code)) throw new HttpError(400, "That code did not match. Try the newest code in your app.");
  await prisma.user.update({ where: { id: u.id }, data: { totpEnabled: true } });
  await audit(u.id, "2fa.enable");
  return { enabled: true };
});

/** Students may turn it off. Staff roles must keep it on. */
export const DELETE = handle(async () => {
  const u = await requireUser();
  if (TWO_FACTOR_ROLES.includes(u.role)) throw new HttpError(403, "Two-factor authentication is required for your role.");
  await prisma.user.update({ where: { id: u.id }, data: { totpEnabled: false, totpSecret: null } });
  await audit(u.id, "2fa.disable");
  return { enabled: false };
});
