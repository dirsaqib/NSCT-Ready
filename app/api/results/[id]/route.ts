export const dynamic = "force-dynamic";
export const maxDuration = 60;
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { logError } from "@/lib/http";
import { mockDetail, type MockDetail } from "@/lib/mockReport";

const BLUE = "#1D55CC", NAVY = "#14213D", MUTED = "#5B6782", TRACK = "#EDF1F7";
const tone = (p: number) => (p >= 70 ? "#13A384" : p >= 50 ? "#F5A623" : "#C2453A");
const fileName = (d: MockDetail, ext: string) => `${d.label}-${d.student.rollNumber}`.replace(/[^\w.-]+/g, "_") + `.${ext}`;

/** One mock result in detail. ?format=pdf or ?format=xlsx to download. */
export async function GET(req: Request, ctx: { params: { id: string } }) {
  try {
    const u = await requireUser();
    const d = await mockDetail(u, ctx.params.id);
    const fmt = new URL(req.url).searchParams.get("format");
    if (fmt === "xlsx") return new Response(await excel(d), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${fileName(d, "xlsx")}"` } });
    if (fmt === "pdf") return new Response(await pdf(d), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fileName(d, "pdf")}"` } });
    return Response.json(d);
  } catch (e) {
    const s = e instanceof HttpError ? e.status : 500;
    if (s === 500) await logError(e, req);
    return Response.json({ error: e instanceof HttpError ? e.message : "Could not load this result." }, { status: s });
  }
}

async function excel(d: MockDetail) {
  const wb = new ExcelJS.Workbook();
  const s1 = wb.addWorksheet("Summary");
  s1.addRows([
    ["TayariHub mock test result"], [],
    ["Student", d.student.fullName], ["Roll number", d.student.rollNumber], ["University", d.student.university], ["Department", d.student.department ?? ""],
    ["Program", `${d.student.program} ${d.student.semester}${d.student.section ?? ""}`], ["Test", d.label], ["Date", d.submittedAt ? new Date(d.submittedAt).toLocaleString("en-GB", { timeZone: "Asia/Karachi" }) : ""],
    ["Time taken (minutes)", d.minutes], ["Score %", d.score], ["Correct", d.correct], ["Wrong", d.wrong], ["Left blank", d.skipped], ["Total questions", d.total],
    ...(d.autoSubmitted ? [["Auto-submitted", d.autoSubmitted]] : []),
  ]);
  s1.getRow(1).font = { bold: true, size: 14 }; s1.getColumn(1).width = 22; s1.getColumn(2).width = 40;
  const s2 = wb.addWorksheet("Sections");
  s2.columns = [{ header: "Section", key: "n", width: 34 }, { header: "NSCT weight %", key: "w", width: 14 }, { header: "Questions", key: "t", width: 11 }, { header: "Correct", key: "c", width: 9 }, { header: "Wrong", key: "x", width: 8 }, { header: "Left blank", key: "s", width: 11 }, { header: "Score %", key: "p", width: 9 }];
  d.sections.forEach((s) => s2.addRow({ n: s.name, w: s.weight, t: s.total, c: s.correct, x: s.wrong, s: s.skipped, p: s.pct }));
  s2.addRow({ n: "Total", t: d.total, c: d.correct, x: d.wrong, s: d.skipped, p: d.score }).font = { bold: true };
  const s3 = wb.addWorksheet("Questions");
  s3.columns = [{ header: "No.", key: "n", width: 6 }, { header: "Section", key: "s", width: 12 }, { header: "Topic", key: "t", width: 34 }, { header: "Result", key: "r", width: 10 }, { header: "Time (sec)", key: "x", width: 10 }];
  d.questions.forEach((q) => s3.addRow({ n: q.n, s: q.subject, t: q.topic, r: q.status === "skipped" ? "left blank" : q.status, x: q.timeSec }));
  for (const ws of [s2, s3]) { ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D55CC" } }; }
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

async function pdf(d: MockDetail) {
  const doc = new PDFDocument({ size: "A4", margin: 44 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(chunks))));
  const L = 44, W = 507;
  doc.rect(0, 0, 595, 78).fill(NAVY);
  doc.fillColor("#fff").fontSize(18).text(`${d.label} result`, L, 18, { width: 330 });
  doc.fontSize(9).fillColor("#DCE6FB").text(`${d.student.fullName}  |  ${d.student.rollNumber}  |  ${d.student.program} ${d.student.semester}${d.student.section ?? ""}`, L, 44, { width: 330 });
  doc.text(`${d.student.university}${d.student.department ? `\n${d.student.department}` : ""}`, 380, 18, { width: 171, align: "right" });
  doc.fillColor(MUTED).fontSize(8).text(`Submitted ${d.submittedAt ? new Date(d.submittedAt).toLocaleString("en-GB", { timeZone: "Asia/Karachi" }) : ""}  |  ${d.minutes} minutes${d.autoSubmitted ? `  |  Auto-submitted (${d.autoSubmitted})` : ""}`, L, 86);

  const boxes: [string, string, string][] = [["Score", `${d.score}%`, tone(d.score)], ["Correct", `${d.correct}`, "#13A384"], ["Wrong", `${d.wrong}`, "#C2453A"], ["Left blank", `${d.skipped}`, "#8A5A0B"], ["Questions", `${d.total}`, NAVY]];
  boxes.forEach(([k, v, c], i) => {
    const x = L + i * (W / 5), y = 104;
    doc.roundedRect(x + 3, y, W / 5 - 6, 52, 6).fill(TRACK);
    doc.fillColor(c).fontSize(18).text(v, x + 3, y + 9, { width: W / 5 - 6, align: "center" });
    doc.fillColor(MUTED).fontSize(8).text(k, x + 3, y + 34, { width: W / 5 - 6, align: "center" });
  });

  let y = 174;
  doc.fillColor(NAVY).fontSize(12).text("Section-wise result", L, y); y += 18;
  doc.fontSize(8).fillColor(MUTED).text("Section (NSCT weight)", L, y).text("Correct", 300, y, { width: 40, align: "center" }).text("Wrong", 340, y, { width: 40, align: "center" }).text("Blank", 380, y, { width: 40, align: "center" }).text("Score", 420, y, { width: 131 });
  y += 13;
  for (const s of d.sections) {
    doc.fontSize(9).fillColor(NAVY).text(`${s.name} (${s.weight}%)`, L, y, { width: 250 });
    doc.fillColor("#13A384").text(`${s.correct}/${s.total}`, 300, y, { width: 40, align: "center" });
    doc.fillColor("#C2453A").text(`${s.wrong}`, 340, y, { width: 40, align: "center" });
    doc.fillColor("#8A5A0B").text(`${s.skipped}`, 380, y, { width: 40, align: "center" });
    doc.rect(424, y + 2, 95, 8).fill(TRACK); doc.rect(424, y + 2, 0.95 * s.pct, 8).fill(tone(s.pct));
    doc.fillColor(NAVY).text(`${s.pct}%`, 523, y, { width: 28, align: "right" });
    y += 17;
  }
  y += 8;
  doc.fillColor(NAVY).fontSize(12).text("Topics to revise", L, y); y += 16;
  if (!d.weakTopics.length) { doc.fontSize(9).fillColor(MUTED).text("No mistakes. Excellent work.", L, y); y += 14; }
  for (const t of d.weakTopics) { doc.fontSize(9).fillColor("#C2453A").text(`${t.wrong} of ${t.total} missed`, L, y, { width: 90 }); doc.fillColor(NAVY).text(`${t.topic} (${t.subject})`, L + 95, y, { width: 410 }); y += 13; }

  y += 10;
  if (y + 30 + Math.ceil(d.questions.length / 10) * 24 > 800) { doc.addPage(); y = 50; }
  doc.fillColor(NAVY).fontSize(12).text("Question by question", L, y); y += 16;
  const perRow = 10, cell = W / perRow;
  d.questions.forEach((q, i) => {
    const cx = L + (i % perRow) * cell, cy = y + Math.floor(i / perRow) * 24;
    const c = q.status === "correct" ? "#13A384" : q.status === "wrong" ? "#C2453A" : "#B9C2D3";
    doc.roundedRect(cx + 2, cy, cell - 4, 20, 4).fill(c);
    doc.fillColor("#fff").fontSize(7.5).text(`${q.n} ${q.subject}`, cx + 2, cy + 6, { width: cell - 4, align: "center" });
  });
  doc.fontSize(7.5).fillColor(MUTED).text("Green = correct, red = wrong, grey = skipped. TayariHub practice result, not an official NSCT result.", L, 812, { width: W, align: "center" });
  doc.end();
  return new Uint8Array(await done);
}
