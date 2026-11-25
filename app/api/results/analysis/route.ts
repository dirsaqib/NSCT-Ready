export const dynamic = "force-dynamic";
export const maxDuration = 60;
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireRole, profileScope } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { logError } from "@/lib/http";
import { linkUnassigned } from "@/lib/register";
import { mockList } from "@/lib/mockReport";
import { SUBJECTS } from "@/lib/syllabus";

type Band = "Ready" | "Almost ready" | "Needs work" | "Not started";
const band = (best: number | null): Band => (best == null ? "Not started" : best >= 70 ? "Ready" : best >= 50 ? "Almost ready" : "Needs work");
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

/**
 * Mock test analysis for focal persons, HODs and the super admin: overall, department-wise and student-wise.
 * Readiness band from each student's best mock: Ready 70+, Almost ready 50 to 69, Needs work below 50.
 * Add ?format=xlsx for an Excel workbook with all three views.
 */
export async function GET(req: Request) {
  try {
    const u = await requireRole("HOD");
    const sp = new URL(req.url).searchParams;
    const scope = u.role === "ADMIN" && !sp.get("universityId") ? {} : profileScope(u, sp.get("universityId"));
    if ((scope as { universityId?: string }).universityId) await linkUnassigned((scope as { universityId: string }).universityId).catch(() => 0);
    const deptFilter = sp.get("department") || "";
    const where = { ...scope, ...(deptFilter ? { departmentId: deptFilter } : {}) };

    const [profiles, attempts] = await Promise.all([
      prisma.profile.findMany({ where, select: { userId: true, fullName: true, rollNumber: true, program: true, semester: true, section: true, departmentId: true, department: { select: { name: true } }, user: { select: { lastSeenAt: true, status: true } } } }),
      mockList(u, { take: 3000 }),
    ]);
    const ids = new Set(profiles.map((p) => p.userId));
    const mine = attempts.filter((a) => ids.has(a.userId)).filter((a) => /^Mock [123]$/.test(a.label));

    // Per student
    const byStudent = new Map<string, typeof mine>();
    mine.forEach((a) => byStudent.set(a.userId, [...(byStudent.get(a.userId) ?? []), a]));
    const students = profiles.map((p) => {
      const as = (byStudent.get(p.userId) ?? []).sort((x, y) => new Date(x.submittedAt!).getTime() - new Date(y.submittedAt!).getTime());
      const bestOf = (n: number) => { const s = as.filter((a) => a.label === `Mock ${n}`).map((a) => a.score); return s.length ? Math.max(...s) : null; };
      const m1 = bestOf(1), m2 = bestOf(2), m3 = bestOf(3);
      const best = as.length ? Math.max(...as.map((a) => a.score)) : null;
      const latest = as.length ? as[as.length - 1].score : null;
      const sec: Record<string, { c: number; t: number }> = {};
      as.forEach((a) => Object.entries(a.sections).forEach(([k, v]) => { sec[k] = sec[k] ?? { c: 0, t: 0 }; sec[k].c += v.c; sec[k].t += v.t; }));
      const secPct = Object.fromEntries(Object.entries(sec).map(([k, v]) => [k, pct(v.c, v.t)]));
      const weak = Object.entries(secPct).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([k, v]) => `${SUBJECTS.find((s) => s.key === k)?.short ?? k} ${v}%`);
      const first = as.length ? as[0].score : null;
      const b = band(best);
      const advice = b === "Not started" ? "Has not taken a mock. Ask the student to take Mock 1 this week."
        : b === "Ready" ? (m3 == null ? "On track. Take the next mock to confirm readiness." : "Ready for NSCT. Keep practising weak sections to stay sharp.")
        : b === "Almost ready" ? `Close. Focus on ${weak.join(" and ") || "weak sections"}, then retake the latest mock.`
        : `Needs support. Re-study ${weak.join(" and ") || "the basics"} with Preparation levels and videos before the next mock.`;
      return {
        userId: p.userId, fullName: p.fullName, rollNumber: p.rollNumber, program: p.program, semester: p.semester, section: p.section,
        department: p.department?.name ?? "No department yet", mocksTaken: as.length, m1, m2, m3, best, latest,
        change: first != null && latest != null && as.length > 1 ? latest - first : null, band: b, sections: secPct, weak, advice,
        autoSubmitted: as.filter((a) => a.autoSubmitted).length,
      };
    });

    const took = students.filter((s) => s.best != null);
    const bands = (xs: typeof students) => ({ Ready: xs.filter((s) => s.band === "Ready").length, "Almost ready": xs.filter((s) => s.band === "Almost ready").length, "Needs work": xs.filter((s) => s.band === "Needs work").length, "Not started": xs.filter((s) => s.band === "Not started").length });
    const secAvg = (xs: typeof mine) => SUBJECTS.map((s) => {
      let c = 0, t = 0; xs.forEach((a) => { const v = a.sections[s.key]; if (v) { c += v.c; t += v.t; } });
      return { key: s.key, name: s.name, short: s.short, weight: s.weight, pct: t ? pct(c, t) : null, questions: t };
    });
    const mockAvg = (n: number) => avg(mine.filter((a) => a.label === `Mock ${n}`).map((a) => a.score));

    // Students who took two mocks: did they improve?
    const improvers = students.filter((s) => s.change != null);
    const overall = {
      registered: students.length, tookMock: took.length, tookPct: pct(took.length, students.length),
      funnel: [{ step: "Registered", n: students.length }, { step: "Took Mock 1", n: students.filter((s) => s.m1 != null).length }, { step: "Took Mock 2", n: students.filter((s) => s.m2 != null).length }, { step: "Took Mock 3", n: students.filter((s) => s.m3 != null).length }],
      avgBest: avg(took.map((s) => s.best!)), mockAvg: [1, 2, 3].map((n) => ({ n, avg: mockAvg(n), attempts: mine.filter((a) => a.label === `Mock ${n}`).length })),
      bands: bands(students), sections: secAvg(mine),
      improved: improvers.filter((s) => s.change! > 0).length, declined: improvers.filter((s) => s.change! < 0).length, avgChange: avg(improvers.map((s) => s.change!)),
      autoSubmitted: mine.filter((a) => a.autoSubmitted).length, attempts: mine.length,
    };

    const deptNames = [...new Set(students.map((s) => s.department))];
    const departments = deptNames.map((d) => {
      const xs = students.filter((s) => s.department === d), tk = xs.filter((s) => s.best != null);
      const att = mine.filter((a) => xs.some((s) => s.userId === a.userId));
      const secs = secAvg(att).filter((x) => x.pct != null).sort((a, b) => a.pct! - b.pct!);
      return { department: d, registered: xs.length, tookMock: tk.length, tookPct: pct(tk.length, xs.length), avgBest: avg(tk.map((s) => s.best!)), m1: avg(att.filter((a) => a.label === "Mock 1").map((a) => a.score)), m2: avg(att.filter((a) => a.label === "Mock 2").map((a) => a.score)), m3: avg(att.filter((a) => a.label === "Mock 3").map((a) => a.score)), bands: bands(xs), readyPct: pct(xs.filter((s) => s.band === "Ready").length, xs.length), weakest: secs.slice(0, 2).map((x) => `${x.short} ${x.pct}%`), strongest: secs.slice(-1).map((x) => `${x.short} ${x.pct}%`)[0] ?? null };
    }).sort((a, b) => b.registered - a.registered);

    const filters = { departments: [...new Map(profiles.filter((p) => p.departmentId).map((p) => [p.departmentId!, p.department!.name])).entries()].map(([id, name]) => ({ id, name })) };
    students.sort((a, b) => (b.best ?? -1) - (a.best ?? -1) || a.rollNumber.localeCompare(b.rollNumber));

    if (sp.get("format") !== "xlsx") return Response.json({ overall, departments, students, filters, scoped: !!(scope as { departmentId?: string }).departmentId });

    const wb = new ExcelJS.Workbook();
    const head = (ws: ExcelJS.Worksheet) => { ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D55CC" } }; ws.views = [{ state: "frozen", ySplit: 1 }]; };
    const o = wb.addWorksheet("Overall");
    o.columns = [{ header: "Measure", key: "k", width: 36 }, { header: "Value", key: "v", width: 18 }];
    [["Registered students", overall.registered], ["Took at least one mock", `${overall.tookMock} (${overall.tookPct}%)`], ["Average best mock score", overall.avgBest ?? ""], ["Mock 1 average", overall.mockAvg[0].avg ?? ""], ["Mock 2 average", overall.mockAvg[1].avg ?? ""], ["Mock 3 average", overall.mockAvg[2].avg ?? ""], ["Ready (70+)", overall.bands.Ready], ["Almost ready (50-69)", overall.bands["Almost ready"]], ["Needs work (below 50)", overall.bands["Needs work"]], ["Not started", overall.bands["Not started"]], ["Improved between mocks", overall.improved], ["Declined between mocks", overall.declined], ["Auto-submitted tests", overall.autoSubmitted]].forEach(([k, v]) => o.addRow({ k, v }));
    o.addRow({}); o.addRow({ k: "Section", v: "Average correct %" }).font = { bold: true };
    overall.sections.forEach((s) => o.addRow({ k: `${s.name} (${s.weight}%)`, v: s.pct ?? "" }));
    head(o);
    const d = wb.addWorksheet("Departments");
    d.columns = [{ header: "Department", key: "d", width: 30 }, { header: "Registered", key: "r", width: 11 }, { header: "Took a mock", key: "t", width: 12 }, { header: "Took %", key: "tp", width: 8 }, { header: "Avg best", key: "ab", width: 9 }, { header: "Mock 1 avg", key: "m1", width: 10 }, { header: "Mock 2 avg", key: "m2", width: 10 }, { header: "Mock 3 avg", key: "m3", width: 10 }, { header: "Ready", key: "re", width: 8 }, { header: "Almost", key: "al", width: 8 }, { header: "Needs work", key: "nw", width: 11 }, { header: "Not started", key: "ns", width: 11 }, { header: "Weakest sections", key: "w", width: 26 }];
    departments.forEach((x) => d.addRow({ d: x.department, r: x.registered, t: x.tookMock, tp: x.tookPct, ab: x.avgBest ?? "", m1: x.m1 ?? "", m2: x.m2 ?? "", m3: x.m3 ?? "", re: x.bands.Ready, al: x.bands["Almost ready"], nw: x.bands["Needs work"], ns: x.bands["Not started"], w: x.weakest.join(", ") }));
    head(d);
    const s = wb.addWorksheet("Students");
    s.columns = [{ header: "Student", key: "n", width: 26 }, { header: "Roll", key: "r", width: 13 }, { header: "Department", key: "d", width: 24 }, { header: "Program", key: "p", width: 12 }, { header: "Mocks taken", key: "mt", width: 11 }, { header: "Mock 1", key: "m1", width: 8 }, { header: "Mock 2", key: "m2", width: 8 }, { header: "Mock 3", key: "m3", width: 8 }, { header: "Best", key: "b", width: 7 }, { header: "Change", key: "c", width: 8 }, { header: "Readiness", key: "band", width: 14 }, ...SUBJECTS.map((x) => ({ header: `${x.short} %`, key: x.key, width: 8 })), { header: "Advice", key: "a", width: 60 }];
    students.forEach((x) => s.addRow({ n: x.fullName, r: x.rollNumber, d: x.department, p: `${x.program} ${x.semester}${x.section ?? ""}`, mt: x.mocksTaken, m1: x.m1 ?? "", m2: x.m2 ?? "", m3: x.m3 ?? "", b: x.best ?? "", c: x.change ?? "", band: x.band, ...Object.fromEntries(SUBJECTS.map((k) => [k.key, x.sections[k.key] ?? ""])), a: x.advice }));
    head(s);
    const buf = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(buf as ArrayBuffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="mock-analysis.xlsx"` } });
  } catch (e) {
    const st = e instanceof HttpError ? e.status : 500;
    if (st === 500) await logError(e, req);
    return Response.json({ error: e instanceof HttpError ? e.message : "Could not build the analysis." }, { status: st });
  }
}
