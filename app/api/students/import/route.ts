export const dynamic = "force-dynamic";
export const maxDuration = 60;
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireRole, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { normalisePhone } from "@/lib/otp";
import { hashPassword, tempPassword } from "@/lib/password";

/**
 * Bulk upload students from Excel or a Moodle user export (CSV saved as .xlsx).
 * Columns: full_name, roll_number, email, phone, program, semester, section, campus, department.
 * Moodle exports use firstname, lastname, idnumber, email, which are also accepted.
 * Uploaded students are created as VERIFIED because the university supplied them. Each new student gets a
 * temporary password that must be changed at first sign-in. The login is university plus roll number.
 */
export const POST = handle(async (req: Request) => {
  const u = await requireRole("CAMPUS_ADMIN");
  if (!u.universityId && u.role !== "ADMIN") throw new HttpError(403, "Your account is not linked to a university.");
  const form = await req.formData();
  const file = form.get("file");
  const universityId = u.role === "ADMIN" ? String(form.get("universityId") || "") : u.universityId!;
  if (!universityId) throw new HttpError(400, "Choose a university.");
  if (!(file instanceof File)) throw new HttpError(400, "Upload an .xlsx file.");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  const head = (ws.getRow(1).values as unknown[]).map((v) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, "_"));
  const col = (row: ExcelJS.Row, ...names: string[]) => { for (const n of names) { const i = head.indexOf(n); if (i > 0) { const v = String(row.getCell(i).text ?? "").trim(); if (v) return v; } } return ""; };

  const campuses = await prisma.campus.findMany({ where: { universityId }, include: { departments: true } });
  let created = 0, updated = 0;
  const failed: { row: number; error: string }[] = [];
  const newIds: string[] = [];
  const credentials: { name: string; rollNumber: string; password: string; status: string }[] = [];
  const resetExisting = form.get("resetExisting") === "yes";

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = col(row, "full_name", "name") || [col(row, "firstname"), col(row, "lastname")].filter(Boolean).join(" ");
    const roll = col(row, "roll_number", "roll_no", "idnumber", "registration_no");
    if (!name && !roll) continue;
    try {
      if (!name || !roll) throw new Error("Name and roll number are required.");
      const email = col(row, "email").toLowerCase() || null;
      const phoneRaw = col(row, "phone", "mobile");
      const phone = phoneRaw ? normalisePhone(phoneRaw) : null;
      const campus = campuses.find((c) => c.name.toLowerCase() === col(row, "campus").toLowerCase()) ?? (campuses.length === 1 ? campuses[0] : undefined);
      const dept = campus?.departments.find((d) => d.name.toLowerCase() === col(row, "department").toLowerCase());
      const existing = await prisma.profile.findUnique({ where: { universityId_rollNumber: { universityId, rollNumber: roll } } });
      const byContact = existing ? null : email || phone ? await prisma.user.findFirst({ where: { OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] } }) : null;
      if (byContact && byContact.role !== "STUDENT") throw new Error("This email or phone belongs to a staff account.");
      const userId = existing?.userId ?? byContact?.id;
      const prev = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } }) : null;
      const temp = !userId || !prev?.passwordHash || resetExisting ? tempPassword() : null;
      const pw = temp ? { passwordHash: hashPassword(temp, true), mustChangePassword: true } : {};
      const user = userId
        ? await prisma.user.update({ where: { id: userId }, data: { status: "VERIFIED", universityId, campusId: campus?.id, departmentId: dept?.id, name, ...pw } })
        : await prisma.user.create({ data: { email, phone, name, role: "STUDENT", status: "VERIFIED", universityId, campusId: campus?.id, departmentId: dept?.id, ...pw } });
      if (temp) credentials.push({ name, rollNumber: roll, password: temp, status: userId ? "password reset" : "new" });
      const data = {
        fullName: name, universityId, rollNumber: roll, program: col(row, "program") || "Not given", semester: col(row, "semester") || "7",
        section: col(row, "section") || null, campusId: campus?.id ?? null, departmentId: dept?.id ?? null, verifiedById: u.id, verifiedAt: new Date(),
      };
      if (await prisma.profile.findUnique({ where: { userId: user.id } })) { await prisma.profile.update({ where: { userId: user.id }, data }); updated++; }
      else { await prisma.profile.create({ data: { userId: user.id, ...data } }); created++; newIds.push(user.id); }
    } catch (e) {
      failed.push({ row: r, error: (e as Error).message.slice(0, 200) });
    }
  }
  if (newIds.length) await notify(newIds, "Your TayariHub account is ready", "Your university has registered you. Your focal person will give you a temporary password. Sign in with your university and roll number.", ["EMAIL"], "/signin").catch(() => {});
  await audit(u.id, "students.import", universityId, { created, updated, failed: failed.length, passwords: credentials.length });
  return { created, updated, failed, credentials };
});
