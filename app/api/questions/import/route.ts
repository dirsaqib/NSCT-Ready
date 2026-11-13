import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { QuestionInput, createQuestion, ownerDepartmentFor } from "@/lib/questions";

/** Splits one CSV line, honouring quotes. */
function csvRow(line: string) {
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === "," && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

/**
 * Bulk upload from Excel (.xlsx) or CSV, for faculty, HODs, campus admins, focal persons and the super admin.
 * Columns: type, subject, topic, difficulty, skill_level, question, code, option_a .. option_f,
 * correct (e.g. "B" or "A,C"), explanation, secure (super admin only).
 * Form fields: bank = DEPARTMENT (live at once in the department's own bank) or NATIONAL (sent for review),
 * departmentId (focal persons and admins choose the department).
 */
export const POST = handle(async (req: Request) => {
  const u = await requireRole("FACULTY");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Upload an .xlsx or .csv file.");
  if (file.size > 5 * 1024 * 1024) throw new HttpError(400, "The file is larger than 5 MB. Split it into smaller files.");
  const bank = form.get("bank") === "DEPARTMENT" ? "DEPARTMENT" : "NATIONAL";
  const owner = bank === "DEPARTMENT" ? await ownerDepartmentFor(u, String(form.get("departmentId") || "") || null) : null;

  let rows: Record<string, string>[] = [];
  if (/\.csv$/i.test(file.name)) {
    const lines = (await file.text()).replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
    const head = csvRow(lines[0] ?? "").map((h) => h.toLowerCase());
    rows = lines.slice(1).map((l) => { const c = csvRow(l); return Object.fromEntries(head.map((h, i) => [h, c[i] ?? ""])); });
  } else {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const head = (ws.getRow(1).values as unknown[]).map((v) => String(v ?? "").trim().toLowerCase());
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      rows.push(Object.fromEntries(head.map((h, i) => [h, i > 0 ? String(row.getCell(i).text ?? "").trim() : ""])));
    }
  }
  if (rows.length > 1000) throw new HttpError(400, "Upload at most 1,000 questions at a time.");

  const added: string[] = [];
  const failed: { row: number; error: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const col = (n: string) => rows[i][n] ?? "";
    if (!col("question")) continue;
    const options = ["a", "b", "c", "d", "e", "f"].map((k) => col(`option_${k}`)).filter(Boolean);
    const answers = col("correct").toUpperCase().split(/[,\s]+/).filter(Boolean).map((l) => "ABCDEF".indexOf(l));
    try {
      const d = QuestionInput.parse({
        type: (col("type") || "SINGLE").toUpperCase(), subject: col("subject").toUpperCase(), topic: col("topic"),
        difficulty: Number(col("difficulty") || 2), skillLevel: col("skill_level") || undefined, text: col("question"),
        code: col("code") || null, options, answers, explanation: col("explanation") || "See your instructor.", source: "IMPORT",
        secure: u.role === "ADMIN" && /^y/i.test(col("secure")), bank,
      });
      added.push((await createQuestion(d, u.id, u.universityId, u.role === "ADMIN", owner)).id);
    } catch (e) {
      failed.push({ row: i + 2, error: e instanceof Error ? e.message.slice(0, 200) : "Invalid row" });
    }
  }
  await audit(u.id, "question.import", owner, { bank, added: added.length, failed: failed.length });
  return { added: added.length, failed, bank };
});
