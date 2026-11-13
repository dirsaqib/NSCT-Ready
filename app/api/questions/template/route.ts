export const dynamic = "force-dynamic";
import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth";

/** A ready-to-fill Excel template for bulk question upload, with two example rows. */
export async function GET() {
  await requireRole("FACULTY");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Questions");
  ws.columns = ["type", "subject", "topic", "difficulty", "skill_level", "question", "code", "option_a", "option_b", "option_c", "option_d", "option_e", "option_f", "correct", "explanation"].map((h) => ({ header: h, key: h, width: h === "question" || h === "explanation" ? 50 : 16 }));
  ws.getRow(1).font = { bold: true };
  ws.addRow({ type: "SINGLE", subject: "DSA", topic: "Stacks", difficulty: 1, skill_level: "Understand", question: "Which data structure works Last In, First Out?", option_a: "Queue", option_b: "Stack", option_c: "Tree", option_d: "Graph", correct: "B", explanation: "A stack removes the most recently added item first." });
  ws.addRow({ type: "MULTI", subject: "DB", topic: "Transactions", difficulty: 2, skill_level: "Remember", question: "Which of these are ACID properties?", option_a: "Atomicity", option_b: "Replication", option_c: "Isolation", option_d: "Durability", correct: "A,C,D", explanation: "ACID is Atomicity, Consistency, Isolation and Durability." });
  const notes = wb.addWorksheet("How to fill");
  [["type", "SINGLE (one answer) or MULTI (two or more answers)"], ["subject", "PS, PROG, DSA, DB, SE, WEB, AI, NET, OS, SEC"], ["difficulty", "1 easy, 2 medium, 3 hard"], ["skill_level", "Remember, Understand, Apply, Analyse, Evaluate or Create (optional)"], ["correct", "Letters of the correct options, e.g. B or A,C"], ["code", "Optional code shown with the question"]].forEach((r) => notes.addRow(r));
  notes.getColumn(1).width = 14; notes.getColumn(2).width = 70;
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="nsct-question-template.xlsx"' } });
}
