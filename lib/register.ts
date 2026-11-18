// Shared helpers for self-registration and proof files.
import { prisma } from "./db";
import { HttpError } from "./errors";

const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_PROOF = 2 * 1024 * 1024;

/** Read and check an uploaded proof file (image or PDF, up to 2 MB). */
export async function readProof(form: FormData, field = "proof") {
  const f = form.get(field);
  if (!(f instanceof File) || f.size === 0) throw new HttpError(400, "Please attach your proof (photo or PDF).");
  if (f.size > MAX_PROOF) throw new HttpError(400, "The proof file must be 2 MB or smaller.");
  if (!OK_TYPES.includes(f.type)) throw new HttpError(400, "The proof must be a JPG, PNG, WEBP image or a PDF.");
  return { filename: f.name.slice(0, 120) || "proof", mime: f.type, size: f.size, data: Buffer.from(await f.arrayBuffer()) };
}

export const str = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

export async function emailTaken(email: string | null) {
  if (!email) return false;
  return !!(await prisma.user.findUnique({ where: { email }, select: { id: true } }));
}
