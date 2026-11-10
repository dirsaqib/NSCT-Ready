import PDFDocument from "pdfkit";
import { requireAnyRole } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { sponsorImpact } from "@/lib/sponsor";
import { audit } from "@/lib/audit";

/** Sponsor impact report as a PDF: seats, reach, activity, score gain, branded certificates, events. */
export async function GET(req: Request) {
  try {
    const u = await requireAnyRole(["SPONSOR", "ADMIN"]);
    const asked = new URL(req.url).searchParams.get("sponsorId");
    const d = await sponsorImpact((u.role === "ADMIN" && asked) || u.sponsorId || "-");
    if (!d.sponsor) throw new HttpError(404, "No sponsor linked to this account.");
    await audit(u.id, "report.sponsor", d.sponsor.id);

    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(chunks))));
    const fmt = (x: Date | null) => (x ? new Date(x).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "open");

    doc.fillColor("#0B6E4F").fontSize(20).text(`${d.sponsor.name}: impact report`);
    doc.fillColor("#5E6B64").fontSize(10).text(`NSCT Ready · contract ${fmt(d.sponsor.contractStart)} to ${fmt(d.sponsor.contractEnd)} · generated ${fmt(new Date())}`);
    doc.moveDown(1.2).fillColor("#1B2420").fontSize(12);
    const rows: [string, string][] = [
      ["Sponsored seats", `${d.usedSeats} used of ${d.seats}`],
      ["Students active", String(d.activeStudents)],
      ["Tests taken", String(d.testsTaken)],
      ["Average readiness", `${d.avgReadiness} of 100`],
      ["Average score gain", d.improvement.avgScoreGain == null ? "Not enough data yet" : `${d.improvement.avgScoreGain} points across ${d.improvement.students} students`],
      ["Certificates carrying your brand", String(d.certificatesBranded)],
    ];
    rows.forEach(([k, v]) => { doc.font("Helvetica-Bold").text(k, { continued: true }).font("Helvetica").text(`   ${v}`); doc.moveDown(0.3); });
    doc.moveDown().font("Helvetica-Bold").fontSize(14).text("Universities reached").font("Helvetica").fontSize(11);
    d.universities.forEach((x) => doc.text(`${x.name}: ${x.students} students`));
    doc.moveDown().font("Helvetica-Bold").fontSize(14).text("Tests per month").font("Helvetica").fontSize(11);
    d.monthlyTests.forEach((m) => doc.text(`${m.month}: ${m.tests}`));
    if (d.events.length) {
      doc.moveDown().font("Helvetica-Bold").fontSize(14).text("Events").font("Helvetica").fontSize(11);
      d.events.forEach((e) => doc.text(`${e.title}, ${fmt(e.date)}${e.venue ? `, ${e.venue}` : ""}`));
    }
    doc.moveDown(2).fillColor("#5E6B64").fontSize(9).text("Aggregated figures only. No individual student data is included.");
    doc.end();
    return new Response(await done, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="sponsor-impact.pdf"` } });
  } catch (e) {
    const s = e instanceof HttpError ? e.status : 500;
    return Response.json({ error: e instanceof HttpError ? e.message : "Could not build the report." }, { status: s });
  }
}
