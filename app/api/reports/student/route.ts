export const dynamic = "force-dynamic";
export const maxDuration = 60;
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db";
import { requireRole, profileScope } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { logError } from "@/lib/http";
import { coachData, ruleCoach, type CoachData } from "@/lib/coach";

const GREEN = "#0B6E4F", AMBER = "#E9A23B", RED = "#C2453A", INK = "#13201A", MUTED = "#5E6B64", TRACK = "#EDF1EE";
const tone = (p: number) => (p >= 70 ? GREEN : p >= 50 ? AMBER : RED);
const TYPE: Record<string, string> = { DIAGNOSTIC: "Diagnostic", MOCK: "Full mock", NATIONAL_MOCK: "National mock", MINI_MOCK: "Mini mock", PRACTICE: "Practice", LAB_TEST: "Lab test", ASSESSMENT: "Assessment" };

/**
 * Detailed student reports for focal persons to share with HODs.
 * ?id=<student id> for one student, or ?pack=1 with optional departmentId, program, section for one page per student.
 * Always limited to the staff member's own university (or campus or department).
 */
export async function GET(req: Request) {
  try {
    const u = await requireRole("HOD");
    const sp = new URL(req.url).searchParams;
    const scope = profileScope(u, sp.get("universityId"));
    const id = sp.get("id");
    const where = {
      ...scope,
      ...(id ? { userId: id } : {}),
      ...(!id && sp.get("departmentId") && !scope.departmentId ? { departmentId: sp.get("departmentId")! } : {}),
      ...(!id && sp.get("program") ? { program: sp.get("program")! } : {}),
      ...(!id && sp.get("section") ? { section: sp.get("section")! } : {}),
    };
    const profiles = await prisma.profile.findMany({ where, orderBy: [{ program: "asc" }, { section: "asc" }, { fullName: "asc" }], take: 300, include: { university: true, campus: true, department: true } });
    if (!profiles.length) throw new HttpError(404, "No students match this report.");
    if (!id && !sp.get("pack")) throw new HttpError(400, "Choose a student, or ask for a pack.");

    // University comparison: subject averages and readiness ranks.
    const uniId = profiles[0].universityId;
    const [uniMastery, uniReadiness] = await Promise.all([
      prisma.mastery.groupBy({ by: ["subject"], where: { user: { universityId: uniId } }, _sum: { correct: true, total: true } }),
      prisma.profile.findMany({ where: { universityId: uniId, readiness: { gt: 0 } }, select: { readiness: true } }),
    ]);
    const uniAcc = Object.fromEntries(uniMastery.map((m) => [m.subject, m._sum.total ? Math.round((100 * (m._sum.correct ?? 0)) / m._sum.total) : null]));
    const ranks = uniReadiness.map((r) => r.readiness).sort((a, b) => a - b);
    const pct = (r: number) => (ranks.length ? Math.round((100 * ranks.filter((x) => x < r).length) / ranks.length) : null);

    const doc = new PDFDocument({ size: "A4", margin: 44, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(chunks))));

    let first = true;
    for (const p of profiles) {
      const d = await coachData(p.userId);
      if (!d) continue;
      if (!first) doc.addPage();
      first = false;
      page(doc, p, d, uniAcc, pct(p.readiness));
    }
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0; // let the footer sit below the text area without adding a page
      doc.fontSize(7.5).fillColor(MUTED).text(`NSCT Ready detailed report. Platform estimates, not official NSCT results. Confidential: for university staff only. Page ${i + 1} of ${range.count}`, 44, 805, { width: 507, align: "center" });
    }
    doc.end();
    await audit(u.id, id ? "report.student" : "report.pack", id ?? uniId, { students: profiles.length });
    const name = id ? `report-${profiles[0].rollNumber}` : "student-reports";
    return new Response(new Uint8Array(await done), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name.replace(/[^\w.-]/g, "_")}.pdf"` } });
  } catch (e) {
    const s = e instanceof HttpError ? e.status : 500;
    if (s === 500) { console.error(e); await logError(e, req); }
    return Response.json({ error: e instanceof HttpError ? e.message : "Could not build the report." }, { status: s });
  }
}

type P = { fullName: string; rollNumber: string; program: string; semester: string; section: string | null; university: { name: string }; campus: { name: string } | null; department: { name: string } | null; verifiedAt: Date | null };

function page(doc: PDFKit.PDFDocument, p: P, d: CoachData, uniAcc: Record<string, number | null>, percentile: number | null) {
  const L = 44, W = 507;
  doc.rect(0, 0, 595, 70).fill(GREEN);
  doc.fillColor("#fff").fontSize(17).text(p.fullName, L, 18, { width: 360 });
  doc.fontSize(9).text(`${p.rollNumber}  |  ${p.program}, semester ${p.semester}${p.section ? `, section ${p.section}` : ""}`, L, 42, { width: 360 });
  doc.fontSize(9).text(`${p.university.name}${p.campus ? `, ${p.campus.name}` : ""}${p.department ? `\n${p.department.name}` : ""}`, 360, 18, { width: 191, align: "right" });
  doc.fillColor(MUTED).fontSize(8).text(`Generated ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}  |  ${p.verifiedAt ? "Verified by university" : "Not yet verified"}`, L, 78);

  // Key numbers
  const boxes: [string, string][] = [["Readiness", `${d.readiness}/100`], ["Best mock", `${d.bestMock}%`], ["University percentile", percentile == null ? "n/a" : `${percentile}`], ["Tests taken", `${d.tests}`], ["Trend (recent)", d.trend == null ? "n/a" : `${d.trend > 0 ? "+" : ""}${d.trend}`], ["Integrity flags", `${d.integrityFlags}`]];
  boxes.forEach(([k, v], i) => {
    const x = L + (i % 6) * (W / 6), y = 96;
    doc.roundedRect(x + 2, y, W / 6 - 4, 46, 4).fill(TRACK);
    doc.fillColor(INK).fontSize(14).text(v, x + 2, y + 8, { width: W / 6 - 4, align: "center" });
    doc.fillColor(MUTED).fontSize(7).text(k, x + 2, y + 30, { width: W / 6 - 4, align: "center" });
  });

  // Subject table with bars and university comparison
  let y = 156;
  doc.fillColor(INK).fontSize(11).text("Subject accuracy", L, y); y += 16;
  doc.fontSize(7.5).fillColor(MUTED).text("Subject (exam weight)", L, y).text("Student", 300, y).text("Answered", 470, y).text("Uni avg", 515, y); y += 11;
  for (const s of d.subjects) {
    const a = s.acc ?? 0;
    doc.fontSize(8.5).fillColor(INK).text(`${s.name} (${s.weight}%)`, L, y, { width: 250 });
    doc.rect(300, y + 2, 140, 7).fill(TRACK);
    if (s.acc != null) doc.rect(300, y + 2, 1.4 * a, 7).fill(tone(a));
    const ua = uniAcc[s.key];
    if (ua != null) doc.rect(300 + 1.4 * ua - 0.75, y, 1.5, 11).fill(INK);
    doc.fillColor(INK).text(s.acc == null ? "n/a" : `${a}%`, 444, y, { width: 24 }).text(`${s.answered}`, 470, y, { width: 40 }).text(ua == null ? "" : `${ua}%`, 515, y, { width: 36 });
    y += 14;
  }
  doc.fontSize(7).fillColor(MUTED).text("Black tick on each bar = university average.", 300, y); y += 14;

  // Topics
  const col = (title: string, rows: CoachData["weakTopics"], x: number, top: number) => {
    let yy = top;
    doc.fontSize(10).fillColor(INK).text(title, x, yy); yy += 14;
    if (!rows.length) { doc.fontSize(8).fillColor(MUTED).text("Not enough answers yet.", x, yy); return yy + 12; }
    for (const t of rows) { doc.fontSize(8).fillColor(tone(t.acc)).text(`${t.acc}%`, x, yy, { width: 30 }); doc.fillColor(INK).text(`${t.topic} (${t.subject}, ${t.answered} answered)`, x + 32, yy, { width: 210 }); yy += 12; }
    return yy;
  };
  const y1 = col("Weakest topics", d.weakTopics, L, y);
  const y2 = col("Strongest topics", d.strongTopics, L + 262, y);
  y = Math.max(y1, y2) + 10;

  // Test history
  doc.fontSize(10).fillColor(INK).text("Recent tests", L, y); y += 14;
  if (!d.recent.length) { doc.fontSize(8).fillColor(MUTED).text("No tests yet.", L, y); y += 12; }
  const half = Math.ceil(Math.min(d.recent.length, 14) / 2);
  d.recent.slice(0, 14).forEach((r, i) => {
    const x = i < half ? L : L + 262, yy = y + (i % half) * 11;
    doc.fontSize(8).fillColor(MUTED).text(r.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), x, yy, { width: 46 });
    doc.fillColor(INK).text(TYPE[r.type] ?? r.type, x + 48, yy, { width: 120 });
    doc.fillColor(tone(r.score)).text(`${r.score}%`, x + 170, yy, { width: 40 });
  });
  y += half * 11 + 12;

  // Coach recommendations, flowing text so long lines never overlap
  const c = ruleCoach(d);
  if (y > 660) { doc.addPage(); y = 50; }
  doc.rect(L, y, 3, 14).fill(GREEN);
  doc.fillColor(GREEN).fontSize(10).text(`Recommended next steps: ${c.headline}`, L + 10, y + 2, { width: W - 10 });
  doc.moveDown(0.4);
  for (const f of c.focus) {
    doc.fontSize(8.5).fillColor(INK).text(`${f.title}: ${f.why}`, L + 10, doc.y, { width: W - 10 });
    doc.fontSize(8).fillColor(MUTED).text(f.action, L + 10, doc.y, { width: W - 10 });
    doc.moveDown(0.3);
  }
}
