import ExcelJS from "exceljs";
import { requireRole, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { QuestionInput, createQuestion } from "@/lib/questions";

/**
 * Bulk import from Excel. Columns: type, subject, topic, difficulty, skill_level, question, code,
 * option_a .. option_f, correct (e.g. "B" or "A,C"), explanation, secure (yes/no).
 * Each row is validated on its own. The response lists which rows were added and why others failed.
 */
export const POST = handle(async (req: Request) => {
  const u = await requireRole("ADMIN");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Upload an .xlsx file.");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  const head = (ws.getRow(1).values as unknown[]).map((v) => String(v ?? "").trim().toLowerCase());
  const col = (row: ExcelJS.Row, name: string) => { const i = head.indexOf(name); return i > 0 ? String(row.getCell(i).text ?? "").trim() : ""; };
  const added: string[] = [];
  const failed: { row: number; error: string }[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (!col(row, "question")) continue;
    const options = ["a", "b", "c", "d", "e", "f"].map((k) => col(row, `option_${k}`)).filter(Boolean);
    const answers = col(row, "correct").toUpperCase().split(/[,\s]+/).filter(Boolean).map((l) => "ABCDEF".indexOf(l));
    try {
      const d = QuestionInput.parse({
        type: (col(row, "type") || "SINGLE").toUpperCase(), subject: col(row, "subject").toUpperCase(), topic: col(row, "topic"),
        difficulty: Number(col(row, "difficulty") || 2), skillLevel: col(row, "skill_level") || undefined, text: col(row, "question"),
        code: col(row, "code") || null, options, answers, explanation: col(row, "explanation"), source: "IMPORT", secure: /^y/i.test(col(row, "secure")),
      });
      added.push((await createQuestion(d, u.id, null, true)).id);
    } catch (e) {
      failed.push({ row: r, error: e instanceof Error ? e.message.slice(0, 200) : "Invalid row" });
    }
  }
  await audit(u.id, "question.import", null, { added: added.length, failed: failed.length });
  return { added: added.length, failed };
});
