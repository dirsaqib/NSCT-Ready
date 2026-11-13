export const dynamic = "force-dynamic";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireRole, profileScope } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { SUBJECTS } from "@/lib/syllabus";
import { audit } from "@/lib/audit";

/**
 * Downloadable reports for staff: ?format=pdf|xlsx&level=university|department|student&id=<student id>
 * Every report is limited to the staff member's own part of the hierarchy.
 */
export async function GET(req: Request) {
  try {
    const u = await requireRole("HOD");
    const sp = new URL(req.url).searchParams;
    const format = sp.get("format") === "xlsx" ? "xlsx" : "pdf";
    const scope = profileScope(u, sp.get("universityId"));
    const studentId = sp.get("id");
    const where = studentId ? { ...scope, userId: studentId } : scope;
    const profiles = await prisma.profile.findMany({ where, include: { university: true, campus: true, department: true } });
    if (!profiles.length) throw new HttpError(404, "No students in this report.");
    const ids = profiles.map((p) => p.userId);
    const mastery = await prisma.mastery.findMany({ where: { userId: { in: ids } } });
    const tests = await prisma.attempt.groupBy({ by: ["userId"], where: { userId: { in: ids }, submittedAt: { not: null } }, _count: true });
    const nTests = new Map(tests.map((t) => [t.userId, t._count]));
    const acc = (uid: string, s: string) => { const m = mastery.find((x) => x.userId === uid && x.subject === s); return m?.total ? Math.round((100 * m.correct) / m.total) : null; };
    const title = studentId ? `Student report: ${profiles[0].fullName}` : `NSCT readiness report: ${profiles[0].university.name}`;
    await audit(u.id, `report.${format}`, studentId ?? scope.universityId ?? "all");

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Students");
      ws.columns = [
        { header: "Name", key: "name", width: 26 }, { header: "Roll number", key: "roll", width: 16 }, { header: "Campus", key: "campus", width: 18 },
        { header: "Department", key: "dept", width: 22 }, { header: "Program", key: "program", width: 26 }, { header: "Semester", key: "sem", width: 9 },
        { header: "Readiness", key: "readiness", width: 10 }, { header: "Best mock %", key: "best", width: 11 }, { header: "Tests", key: "tests", width: 8 },
        ...SUBJECTS.map((s) => ({ header: `${s.short} %`, key: s.key, width: 12 })),
      ];
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B6E4F" } };
      profiles.forEach((p) => ws.addRow({ name: p.fullName, roll: p.rollNumber, campus: p.campus?.name, dept: p.department?.name, program: p.program, sem: p.semester, readiness: p.readiness, best: p.bestMock, tests: nTests.get(p.userId) ?? 0, ...Object.fromEntries(SUBJECTS.map((s) => [s.key, acc(p.userId, s.key)])) }));
      ws.views = [{ state: "frozen", ySplit: 1 }];
      const buf = await wb.xlsx.writeBuffer();
      return new Response(buf, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="nsct-report.xlsx"` } });
    }

    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(chunks))));
    const active = profiles.filter((p) => (nTests.get(p.userId) ?? 0) > 0);
    const avg = active.length ? Math.round(active.reduce((s, p) => s + p.readiness, 0) / active.length) : 0;
    doc.fillColor("#0B6E4F").fontSize(18).text(title);
    doc.fillColor("#5E6B64").fontSize(10).text(`Generated ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}. Platform estimates, not official NSCT results.`).moveDown();
    doc.fillColor("#13201A").fontSize(12).text(`Students: ${profiles.length}    Active: ${active.length}    Average readiness: ${avg}/100`).moveDown(0.6);
    doc.fontSize(13).text("Accuracy by subject").moveDown(0.3);
    SUBJECTS.forEach((s) => {
      const ms = mastery.filter((m) => m.subject === s.key);
      const t = ms.reduce((a, m) => a + m.total, 0), c = ms.reduce((a, m) => a + m.correct, 0);
      const p = t ? Math.round((100 * c) / t) : 0;
      const y = doc.y;
      doc.fontSize(10).fillColor("#13201A").text(`${s.name} (${s.weight}%)`, 48, y, { width: 240 });
      doc.rect(300, y + 2, 200, 8).fill("#EDF1EE");
      doc.rect(300, y + 2, 2 * p, 8).fill(p >= 70 ? "#0B6E4F" : p >= 50 ? "#E9A23B" : "#C2453A");
      doc.fillColor("#13201A").text(t ? `${p}%` : "n/a", 510, y);
      doc.moveDown(0.4);
    });
    if (!studentId) {
      doc.moveDown().fontSize(13).text("Students below 45 readiness").moveDown(0.3).fontSize(10);
      active.filter((p) => p.readiness < 45).sort((a, b) => a.readiness - b.readiness).slice(0, 40).forEach((p) => doc.text(`${p.fullName} (${p.rollNumber}), ${p.program}: ${p.readiness}`));
    }
    doc.end();
    return new Response(await done, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="nsct-report.pdf"` } });
  } catch (e) {
    const s = e instanceof HttpError ? e.status : 500;
    return Response.json({ error: e instanceof HttpError ? e.message : "Could not build the report." }, { status: s });
  }
}
