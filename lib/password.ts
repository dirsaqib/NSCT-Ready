// Password hashing with Node's built-in scrypt. Stored as scrypt$N$r$p$salt$hash (base64).
import { scryptSync, randomBytes, timingSafeEqual, randomInt } from "crypto";

const N = 16384, R = 8, P = 1, LEN = 32;

/** Hash a password. Temporary passwords use a lighter cost so bulk uploads stay fast; they must be changed anyway. */
export function hashPassword(pw: string, temporary = false) {
  const n = temporary ? 4096 : N;
  const salt = randomBytes(16);
  const h = scryptSync(pw, salt, LEN, { N: n, r: R, p: P });
  return `scrypt$${n}$${R}$${P}$${salt.toString("base64")}$${h.toString("base64")}`;
}

export function verifyPassword(pw: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [algo, n, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64");
  const got = scryptSync(pw, Buffer.from(salt, "base64"), want.length, { N: Number(n), r: Number(r), p: Number(p) });
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Rules for a password the user chooses. Returns an error message or null. */
export function passwordProblem(pw: string) {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (pw.length > 100) return "Password is too long.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Use at least one letter and one number.";
  return null;
}

/** Temporary password for bulk uploads and resets: easy to read aloud, no 0/O or 1/l. */
export function tempPassword() {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ", a = "abcdefghjkmnpqrstuvwxyz", d = "23456789";
  const pick = (s: string, k: number) => Array.from({ length: k }, () => s[randomInt(s.length)]).join("");
  return `${pick(A, 1)}${pick(a, 4)}${pick(d, 4)}`;
}
