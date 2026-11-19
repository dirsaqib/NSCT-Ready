// Shared helpers for self-registration and proof files.
import { prisma } from "./db";
import { createHmac } from "crypto";
import { HttpError } from "./errors";
import { encrypt } from "./crypto";

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

/** Check a CNIC or B-Form number and return its encrypted copy plus a keyed hash for duplicate checks. */
export function cnicFields(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 13) throw new HttpError(400, "Enter your 13 digit CNIC or B-Form number, like 12345-1234567-1.");
  const pretty = `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
  const hash = createHmac("sha256", process.env.APP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "nsct").update(`cnic:${d}`).digest("hex");
  return { cnicHash: hash, cnicEnc: encrypt(pretty) };
}

/** Match a typed campus or department name to the university's records, if one fits. */
export async function matchPlace(universityId: string, campusName: string, departmentName: string) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const campuses = await prisma.campus.findMany({ where: { universityId }, select: { id: true, name: true, city: true, departments: { select: { id: true, name: true } } } });
  const cn = norm(campusName);
  const campus = campuses.find((c) => norm(c.name) === cn) ?? campuses.find((c) => cn && (norm(c.name).includes(cn) || cn.includes(norm(c.name)) || (c.city && norm(c.city) === cn)));
  const dn = norm(departmentName);
  const pool = campus ? [campus, ...campuses.filter((c) => c !== campus)] : campuses;
  let department: { id: string; campusId: string } | undefined;
  for (const c of pool) {
    const d = c.departments.find((x) => norm(x.name) === dn);
    if (d) { department = { id: d.id, campusId: c.id }; break; }
  }
  return { campusId: campus?.id ?? null, departmentId: department?.id ?? null };
}

/** The university picked from the list, or the one typed. A typed name that is not on the list is added as unlisted. */
export async function resolveUniversity(id: string | undefined, typed: string | undefined) {
  if (id) {
    const u = await prisma.university.findUnique({ where: { id }, select: { id: true } });
    if (u) return u.id;
  }
  const name = (typed ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 120) throw new HttpError(400, "Enter your university.");
  const found = await prisma.university.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  if (found) return found.id;
  const created = await prisma.university.create({ data: { name, listed: false } });
  return created.id;
}

// Field rules shared by the sign-up APIs, so fake or garbled entries are rejected even if the form is bypassed.
export const NAME_RE = /^[\p{L}][\p{L} .'-]{1,79}$/u;
export const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
export const PHONE_RE = /^(\+92|0)3\d{9}$/;
export const ROLL_RE = /^[A-Za-z0-9/_-]{2,30}$/;
