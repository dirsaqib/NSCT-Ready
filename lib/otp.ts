// Phone one-time codes for sign-in. Codes are hashed, expire in 5 minutes and allow 5 tries.
import { prisma } from "./db";
import { numericCode, sha256 } from "./crypto";
import { sendSms } from "./notify";
import { HttpError } from "./errors";

export const normalisePhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  if (d.startsWith("92") && d.length === 12) return `+${d}`;
  if (d.startsWith("03") && d.length === 11) return `+92${d.slice(1)}`;
  if (d.startsWith("3") && d.length === 10) return `+92${d}`;
  throw new HttpError(400, "Enter a valid Pakistani mobile number, for example 0300 1234567.");
};

export async function issueOtp(phone: string, purpose = "login") {
  const target = normalisePhone(phone);
  const recent = await prisma.otpCode.count({ where: { target, createdAt: { gte: new Date(Date.now() - 15 * 60000) } } });
  if (recent >= 5) throw new HttpError(429, "Too many codes requested. Please wait 15 minutes.");
  const code = numericCode(6);
  await prisma.otpCode.create({ data: { target, purpose, codeHash: sha256(`${target}:${code}`), expiresAt: new Date(Date.now() + 5 * 60000) } });
  await sendSms(target, `Your NSCT Ready code is ${code}. It expires in 5 minutes. Do not share it.`);
  return { sent: true };
}

export async function verifyOtp(phone: string, code: string, purpose = "login") {
  const target = normalisePhone(phone);
  const row = await prisma.otpCode.findFirst({ where: { target, purpose, usedAt: null }, orderBy: { createdAt: "desc" } });
  if (!row || row.expiresAt < new Date()) return null;
  if (row.attempts >= 5) return null;
  if (row.codeHash !== sha256(`${target}:${code.trim()}`)) {
    await prisma.otpCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return null;
  }
  await prisma.otpCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return target;
}
