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
/**
 * Cleans a roll number the same way everywhere: trims, removes inner spaces, upper-cases, and undoes Excel
 * number formatting ("231,234" or "231234.0" become "231234").
 */
export function normRoll(v: string) {
  let r = String(v ?? "").trim().replace(/\s+/g, "").toUpperCase();
  if (/^\d{1,3}(,\d{3})+$/.test(r)) r = r.replace(/,/g, "");
  if (/^\d+\.0+$/.test(r)) r = r.replace(/\.0+$/, "");
  return r;
}

/** The university's "Main campus", created on first use. Departments live under it. */
export async function mainCampus(universityId: string) {
  const uni = await prisma.university.findUnique({ where: { id: universityId }, select: { city: true } });
  return prisma.campus.upsert({ where: { universityId_name: { universityId, name: "Main campus" } }, create: { universityId, name: "Main campus", city: uni?.city }, update: {} });
}

/** Finds the university's department by name (ignoring case and spacing), or creates it. */
export async function ensureDepartment(universityId: string, departmentName: string) {
  const name = departmentName.trim().replace(/\s+/g, " ");
  const found = await prisma.department.findFirst({ where: { campus: { universityId }, name: { equals: name, mode: "insensitive" } }, select: { id: true, campusId: true } });
  if (found) return found;
  const campus = await mainCampus(universityId);
  return prisma.department.create({ data: { campusId: campus.id, name, programs: [] }, select: { id: true, campusId: true } });
}

const DEPT_ALIASES: Record<string, string[]> = {
  computerscience: ["cs", "bscs", "compsci", "computerscience"], softwareengineering: ["se", "bsse", "software"],
  informationtechnology: ["it", "bsit"], artificialintelligence: ["ai", "bsai"], datascience: ["ds", "bsds"],
  creativetechnologies: ["ct", "creativetechnology", "creativetech"], computergamesdevelopment: ["cgd", "bscgd", "gamesdevelopment", "gamedevelopment", "computergames"],
  cybersecurity: ["cyber", "bscys", "infosec"], computerengineering: ["ce", "bsce", "compeng"],
};
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "").replace(/^(departmentof|deptof|facultyof|schoolof|department|dept)/, "");

/**
 * Links students who registered before their department existed, or typed it differently
 * ("CS", "Dept. of Computer Science"), or left it unclear but chose a program the department offers.
 */
export async function linkUnassigned(universityId: string) {
  const depts = await prisma.department.findMany({ where: { campus: { universityId } }, select: { id: true, name: true, programs: true } });
  if (!depts.length) return 0;
  const loose = await prisma.profile.findMany({ where: { universityId, departmentId: null }, select: { userId: true, departmentName: true, program: true } });
  if (!loose.length) return 0;
  const byDept = new Map<string, string[]>();
  for (const p of loose) {
    const typed = keyOf(p.departmentName ?? "");
    const prog = keyOf(p.program ?? "");
    const d = depts.find((x) => { const k = keyOf(x.name); return typed && (k === typed || (DEPT_ALIASES[k] ?? []).includes(typed) || (typed.length > 5 && (k.includes(typed) || typed.includes(k)))); })
      ?? depts.find((x) => prog && x.programs.some((pp) => keyOf(pp) === prog));
    if (d) byDept.set(d.id, [...(byDept.get(d.id) ?? []), p.userId]);
  }
  let n = 0;
  for (const [id, ids] of byDept) {
    await prisma.profile.updateMany({ where: { userId: { in: ids } }, data: { departmentId: id } });
    await prisma.user.updateMany({ where: { id: { in: ids } }, data: { departmentId: id } });
    n += ids.length;
  }
  return n;
}

/** Links students who have no department yet to the department that lists their program. */
export async function linkByProgram(universityId: string) {
  const depts = await prisma.department.findMany({ where: { campus: { universityId } }, select: { id: true, programs: true } });
  let linked = 0;
  for (const d of depts) {
    if (!d.programs.length) continue;
    const rows = await prisma.profile.findMany({ where: { universityId, departmentId: null, program: { in: d.programs, mode: "insensitive" } }, select: { userId: true } });
    if (!rows.length) continue;
    const ids = rows.map((r) => r.userId);
    await prisma.profile.updateMany({ where: { userId: { in: ids } }, data: { departmentId: d.id } });
    await prisma.user.updateMany({ where: { id: { in: ids } }, data: { departmentId: d.id } });
    linked += ids.length;
  }
  return linked;
}

export async function matchPlace(universityId: string, campusName: string, departmentName: string, program?: string) {
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
  // No department name match: use the department that offers the student's program (e.g. BSIT under Computer Science).
  if (!department && program) {
    const pn = norm(program);
    const d = await prisma.department.findFirst({ where: { campus: { universityId }, programs: { has: program } }, select: { id: true, campusId: true } })
      ?? (await prisma.department.findMany({ where: { campus: { universityId } }, select: { id: true, campusId: true, programs: true } })).find((x) => x.programs.some((pp) => norm(pp) === pn));
    if (d) department = { id: d.id, campusId: d.campusId };
  }
  return { campusId: campus?.id ?? department?.campusId ?? null, departmentId: department?.id ?? null };
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
