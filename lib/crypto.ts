// Encryption for secrets stored in the database (TOTP secrets), hashing for codes.
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

function key(): Buffer {
  const k = process.env.APP_ENCRYPTION_KEY;
  if (!k) throw new Error("APP_ENCRYPTION_KEY is not set");
  return createHash("sha256").update(k).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(token: string): string {
  const [iv, tag, data] = token.split(".").map((s) => Buffer.from(s, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const numericCode = (digits = 6) => String(randomInt(0, 10 ** digits)).padStart(digits, "0");

/** Short, unambiguous public code, e.g. for certificates: NR-7KQ4-M2XD */
export function publicCode(prefix = "NR") {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = () => Array.from({ length: 4 }, () => A[randomInt(0, A.length)]).join("");
  return `${prefix}-${pick()}-${pick()}`;
}

/** Normalised text hash used to catch duplicate or copied questions. */
export function contentHash(text: string, options: string[]) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return sha256([norm(text), ...options.map(norm).sort()].join("|"));
}
