export const dynamic = "force-dynamic";
export const maxDuration = 60;
import ExcelJS from "exceljs";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { logError } from "@/lib/http";
import { mockList } from "@/lib/mockReport";
import { SUBJECTS } from "@/lib/syllabus";

/** Mock results: a student's own, or all students in a staff member's scope. Add ?format=xlsx for Excel. */
export async function GET(req: Request) {
  try {
    const u = await requireUser();
    const sp = new URL(req.url).searchParams;
    const rows = await mockList(u, { label: sp.get("label") || undefined, q: sp.get("q") || undefined, take: sp.get("format") === "xlsx" ? 3000 : 500 });
    if (sp.get("format") !== "xlsx") return Response.json({ rows, staff: u.role !== "STUDENT" });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Mock results");
    const subj = SUBJECTS.map((s) => s.key);
    ws.columns = [
      { header: "Student", key: "name", width: 26 }, { header: "Roll number", key: "roll", width: 14 }, { header: "Department", key: "dept", width: 22 },
      { header: "Program", key: "prog", width: 10 }, { header: "Semester", key: "sem", width: 9 }, { header: "Section", key: "sec", width: 8 },
      { header: "Test", key: "test", width: 12 }, { header: "Date", key: "date", width: 18 }, { header: "Score %", key: "score", width: 9 },
      { header: "Correct", key: "c", width: 9 }, { header: "Wrong", key: "w", width: 8 }, { header: "Left blank", key: "s", width: 11 }, { header: "Total", key: "t", width: 7 },
      ...subj.map((k) => ({ header: `${SUBJECTS.find((s) => s.key === k)!.short} (right/total)`, key: k, width: 14 })),
      { header: "Auto-submitted", key: "auto", width: 14 },
    ];
    for (const r of rows) ws.addRow({
      name: r.fullName, roll: r.rollNumber, dept: r.department ?? "", prog: r.program, sem: r.semester, sec: r.section ?? "", test: r.label,
      date: r.submittedAt ? new Date(r.submittedAt).toLocaleString("en-GB", { timeZone: "Asia/Karachi" }) : "", score: r.score, c: r.correct, w: r.wrong, s: r.skipped, t: r.total,
      ...Object.fromEntries(subj.map((k) => [k, r.sections[k] ? `${r.sections[k].c}/${r.sections[k].t}` : ""])), auto: r.autoSubmitted ? "Yes" : "",
    });
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D55CC" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    const buf = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(buf as ArrayBuffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="mock-results.xlsx"` } });
  } catch (e) {
    const s = e instanceof HttpError ? e.status : 500;
    if (s === 500) await logError(e, req);
    return Response.json({ error: e instanceof HttpError ? e.message : "Could not load results." }, { status: s });
  }
}
