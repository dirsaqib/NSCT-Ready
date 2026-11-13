// Department lab tests: CBT in a computer lab on the portal, or fully offline on a lab network.
import crypto from "crypto";
import type { LabTest, Prisma, Subject } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { HttpError } from "./errors";
import { profileScope, type SessionUser } from "./auth";
import { shuffle } from "./scoring";
import { gradeChoice } from "./tests";
import { getSetting } from "./settings";

export const STAFF_LAB_ROLES = ["HOD", "CAMPUS_ADMIN", "FOCAL", "CHAIR", "ADMIN"] as const;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newAccessCode() {
  return Array.from(crypto.randomBytes(6)).map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export const LabTestInput = z.object({
  title: z.string().min(3).max(120),
  mode: z.enum(["ONLINE_LAB", "OFFLINE_LAN"]),
  departmentId: z.string().nullable().optional(),
  campusId: z.string().nullable().optional(),
  universityId: z.string().optional(),
  durationMin: z.number().int().min(5).max(300),
  opensAt: z.coerce.date(),
  closesAt: z.coerce.date(),
  lateJoinMin: z.number().int().min(0).max(120).default(15),
  ipAllowlist: z.array(z.string().max(50)).max(20).default([]),
  programs: z.array(z.string().max(80)).max(20).default([]),
  sections: z.array(z.string().max(10)).max(30).default([]),
  semesters: z.array(z.string().max(12)).max(10).default([]),
  shuffle: z.boolean().default(true),
  negativeMarking: z.number().min(0).max(1).default(0),
  passMark: z.number().int().min(0).max(100).default(50),
  // Paper: pick explicit questions, or draw counts per subject from a source bank.
  questionIds: z.array(z.string()).max(300).optional(),
  source: z.enum(["DEPARTMENT", "NATIONAL", "BOTH"]).default("DEPARTMENT"),
  counts: z.record(z.string(), z.number().int().min(0).max(100)).optional(),
}).refine((d) => d.closesAt > d.opensAt, { message: "Closing time must be after opening time." });

/** Which questions a staff member may put on a lab paper. */
export function paperPoolWhere(u: SessionUser, source: "DEPARTMENT" | "NATIONAL" | "BOTH", departmentId?: string | null): Prisma.QuestionWhereInput {
  const dept: Prisma.QuestionWhereInput = { scope: "DEPARTMENT", status: "LIVE", ...(departmentId ? { ownerDepartmentId: departmentId } : u.role === "ADMIN" ? {} : { authorUniversityId: u.universityId ?? "-" }) };
  const national: Prisma.QuestionWhereInput = { scope: "NATIONAL", status: "LIVE", secure: false };
  return source === "DEPARTMENT" ? dept : source === "NATIONAL" ? national : { OR: [dept, national] };
}

export async function createLabTest(u: SessionUser, raw: unknown) {
  const d = LabTestInput.parse(raw);
  const scope = profileScope(u, d.universityId);
  const universityId = scope.universityId ?? d.universityId;
  if (!universityId) throw new HttpError(400, "Choose the university.");
  const departmentId = scope.departmentId ?? d.departmentId ?? null;
  const campusId = scope.campusId ?? d.campusId ?? null;

  let ids: string[] = [];
  if (d.questionIds?.length) {
    const ok = await prisma.question.findMany({ where: { id: { in: d.questionIds }, ...paperPoolWhere(u, "BOTH", departmentId) }, select: { id: true } });
    if (ok.length !== d.questionIds.length) throw new HttpError(400, "Some chosen questions are not available to your department.");
    ids = d.questionIds;
  } else {
    if (!d.counts || !Object.values(d.counts).some((n) => n > 0)) throw new HttpError(400, "Choose questions, or how many to draw per subject.");
    for (const [subject, n] of Object.entries(d.counts)) {
      if (!n) continue;
      const rows = await prisma.question.findMany({ where: { subject: subject as Subject, ...paperPoolWhere(u, d.source, departmentId) }, select: { id: true } });
      if (rows.length < n) throw new HttpError(400, `Only ${rows.length} questions available for ${subject}. You asked for ${n}.`);
      ids.push(...shuffle(rows).slice(0, n).map((r) => r.id));
    }
  }
  if (d.mode === "OFFLINE_LAN") {
    const code = await prisma.question.count({ where: { id: { in: ids }, type: "CODE", NOT: { language: "javascript" } } });
    if (code) throw new HttpError(400, `${code} coding questions use a language the offline lab server cannot run. Offline tests support JavaScript coding questions only.`);
  }
  return prisma.labTest.create({
    data: {
      title: d.title, mode: d.mode, universityId, campusId, departmentId, createdById: u.id, questionIds: ids,
      durationMin: d.durationMin, opensAt: d.opensAt, closesAt: d.closesAt, lateJoinMin: d.lateJoinMin,
      ipAllowlist: d.ipAllowlist.map((x) => x.trim()).filter(Boolean), programs: d.programs, sections: d.sections, semesters: d.semesters,
      shuffle: d.shuffle, negativeMarking: d.negativeMarking, passMark: d.passMark,
      accessCode: newAccessCode(), packageSecret: crypto.randomBytes(32).toString("base64"),
    },
  });
}

/** Load a lab test the staff member is allowed to manage. */
export async function labTestForStaff(u: SessionUser, id: string) {
  const t = await prisma.labTest.findUnique({ where: { id } });
  if (!t) throw new HttpError(404, "Lab test not found.");
  if (u.role !== "ADMIN") {
    const s = profileScope(u);
    if (t.universityId !== s.universityId) throw new HttpError(403, "This test belongs to another university.");
    if (s.departmentId && t.departmentId !== s.departmentId) throw new HttpError(403, "This test belongs to another department.");
    if (s.campusId && t.campusId && t.campusId !== s.campusId) throw new HttpError(403, "This test belongs to another campus.");
  }
  return t;
}

/** Students who are expected to sit the test. */
export function rosterWhere(t: LabTest): Prisma.ProfileWhereInput {
  return {
    universityId: t.universityId,
    ...(t.campusId ? { campusId: t.campusId } : {}),
    ...(t.departmentId ? { departmentId: t.departmentId } : {}),
    ...(t.programs.length ? { program: { in: t.programs } } : {}),
    ...(t.sections.length ? { section: { in: t.sections } } : {}),
    ...(t.semesters.length ? { semester: { in: t.semesters } } : {}),
    user: { status: { not: "BLOCKED" } },
  };
}

/** Matches an IP against prefixes like "10.10.4." or IPv4 CIDR blocks like "203.0.113.0/24". */
export function ipAllowed(ip: string | null | undefined, list: string[]) {
  if (!list.length) return true;
  if (!ip) return false;
  const toInt = (a: string) => a.split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
  return list.some((rule) => {
    if (rule.includes("/")) {
      const [base, bits] = rule.split("/");
      if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
      const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
      return (toInt(ip) & mask) === (toInt(base) & mask);
    }
    return ip === rule || ip.startsWith(rule);
  });
}

/** Checks done when a student starts a lab test on the portal. Returns the paper and time. */
export async function labStartCheck(userId: string, labTestId: string, accessCode: string, ip: string | null | undefined) {
  const t = await prisma.labTest.findUnique({ where: { id: labTestId } });
  if (!t) throw new HttpError(404, "Lab test not found.");
  if (t.mode !== "ONLINE_LAB") throw new HttpError(409, "This test runs on the lab server. Open the address your invigilator gives you.");
  const now = Date.now();
  if (t.status !== "LIVE") throw new HttpError(409, t.status === "CLOSED" ? "This test has ended." : "The invigilator has not started this test yet.");
  if (now < t.opensAt.getTime() || now > t.closesAt.getTime()) throw new HttpError(409, "This test is outside its scheduled time.");
  if (t.wentLiveAt && t.lateJoinMin && now > t.wentLiveAt.getTime() + t.lateJoinMin * 60000) throw new HttpError(409, "The late entry time has passed. Speak to your invigilator.");
  if (accessCode.trim().toUpperCase() !== t.accessCode) throw new HttpError(403, "Wrong access code. Check the board in your lab.");
  if (!ipAllowed(ip, t.ipAllowlist)) throw new HttpError(403, "This test can only be taken from the lab computers.");
  const p = await prisma.profile.findFirst({ where: { userId, ...rosterWhere(t) } });
  if (!p) throw new HttpError(403, "You are not on the list for this test.");
  if (await prisma.attempt.count({ where: { userId, labTestId: t.id } })) throw new HttpError(409, "You have already started this test. Ask the invigilator if you were disconnected.");
  return { test: t, ids: t.shuffle ? shuffle(t.questionIds) : t.questionIds, durationMin: t.durationMin + t.extraMin };
}

/** Live view for the invigilator. */
export async function monitor(t: LabTest) {
  const [roster, attempts] = await Promise.all([
    prisma.profile.findMany({ where: rosterWhere(t), select: { userId: true, fullName: true, rollNumber: true, section: true, program: true }, orderBy: { rollNumber: "asc" } }),
    prisma.attempt.findMany({ where: { labTestId: t.id }, include: { items: { select: { chosen: true, code: true } } } }),
  ]);
  const byUser = new Map(attempts.map((a) => [a.userId, a]));
  const now = Date.now();
  const rows = roster.map((r) => {
    const a = byUser.get(r.userId);
    const answered = a ? a.items.filter((i) => i.chosen.length || (i.code ?? "").trim()).length : 0;
    const state = !a ? "NOT_STARTED" : a.submittedAt ? "SUBMITTED" : a.lastSavedAt && now - a.lastSavedAt.getTime() > 90000 ? "DISCONNECTED" : "IN_PROGRESS";
    return {
      userId: r.userId, name: r.fullName, roll: r.rollNumber, section: r.section, program: r.program, state,
      attemptId: a?.id ?? null, seat: a?.seat ?? null, ip: a?.ip ?? null, answered, total: t.questionIds.length,
      tabSwitches: a?.tabSwitches ?? 0, fullscreenExits: a?.fullscreenExits ?? 0, flags: a?.flags ?? [],
      score: a?.submittedAt ? a.score : null, endsAt: a?.endsAt ?? null, lastSavedAt: a?.lastSavedAt ?? null,
    };
  });
  const count = (s: string) => rows.filter((r) => r.state === s).length;
  const scores = rows.filter((r) => r.score != null).map((r) => r.score as number);
  return {
    rows,
    summary: {
      expected: rows.length, notStarted: count("NOT_STARTED"), inProgress: count("IN_PROGRESS"), disconnected: count("DISCONNECTED"), submitted: count("SUBMITTED"),
      average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      passed: scores.filter((s) => s >= t.passMark).length,
    },
  };
}

// ---------- Offline package and signed results ----------

const SCRYPT = { N: 16384, r: 8, p: 1 };
export function encryptPackage(obj: unknown, passphrase: string) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32, SCRYPT);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return { format: "nsct-lab-package/1", kdf: "scrypt", salt: salt.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") };
}

/** Builds the encrypted file the lab server loads. It holds the paper with answers, the student list and a signing key. */
export async function buildPackage(t: LabTest, passphrase: string) {
  if (passphrase.length < 8) throw new HttpError(400, "Use a passphrase of at least 8 characters.");
  const [questions, roster] = await Promise.all([
    prisma.question.findMany({ where: { id: { in: t.questionIds } }, include: { scenario: true } }),
    prisma.profile.findMany({ where: rosterWhere(t), select: { rollNumber: true, fullName: true, section: true, program: true, extraTimePct: true } }),
  ]);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const partial = await getSetting<boolean>("test.multiSelectPartialCredit");
  const payload = {
    test: { id: t.id, title: t.title, durationMin: t.durationMin, opensAt: t.opensAt, closesAt: t.closesAt, shuffle: t.shuffle, negativeMarking: t.negativeMarking, passMark: t.passMark, partialCredit: partial, lateJoinMin: t.lateJoinMin },
    questions: t.questionIds.map((id) => byId.get(id)!).filter(Boolean).map((q) => ({
      id: q.id, type: q.type, subject: q.subject, topic: q.topic, text: q.text, code: q.code, options: q.options, answers: q.answers,
      scenario: q.scenario ? { title: q.scenario.title, passage: q.scenario.passage } : null,
      language: q.language, starterCode: q.starterCode, tests: q.tests,
    })),
    roster: roster.map((r) => ({ roll: r.rollNumber, name: r.fullName, section: r.section, program: r.program, extraPct: r.extraTimePct })),
    signingKey: t.packageSecret,
    builtAt: new Date().toISOString(),
  };
  await prisma.labTest.update({ where: { id: t.id }, data: { packagedAt: new Date() } });
  return encryptPackage(payload, passphrase);
}

const ResultFile = z.object({
  format: z.literal("nsct-lab-results/1"),
  testId: z.string(),
  results: z.array(z.object({
    roll: z.string(),
    seat: z.string().nullable().optional(),
    ip: z.string().nullable().optional(),
    startedAt: z.string(),
    submittedAt: z.string().nullable(),
    tabSwitches: z.number().default(0),
    fullscreenExits: z.number().default(0),
    answers: z.array(z.object({ questionId: z.string(), chosen: z.array(z.number().int()).default([]), code: z.string().nullable().optional(), codePassed: z.number().optional(), codeTotal: z.number().optional(), timeSec: z.number().optional() })),
  })),
  signature: z.string(),
});

export function signResults(secret: string, testId: string, results: unknown) {
  return crypto.createHmac("sha256", Buffer.from(secret, "base64")).update(JSON.stringify({ testId, results })).digest("hex");
}

/** Imports the signed results file from the lab server. The portal grades every answer again itself. */
export async function importResults(t: LabTest, raw: unknown) {
  const f = ResultFile.parse(raw);
  if (f.testId !== t.id) throw new HttpError(400, "This results file belongs to a different test.");
  // Verify against the file exactly as written, before validation adds defaults or reorders fields.
  const expected = signResults(t.packageSecret, f.testId, (raw as { results: unknown }).results);
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(f.signature.padEnd(expected.length).slice(0, expected.length))))
    throw new HttpError(400, "The results file signature does not match. It may have been edited after the test.");

  const qs = await prisma.question.findMany({ where: { id: { in: t.questionIds } } });
  const byId = new Map(qs.map((q) => [q.id, q]));
  const partial = await getSetting<boolean>("test.multiSelectPartialCredit");
  const profiles = await prisma.profile.findMany({ where: { universityId: t.universityId, rollNumber: { in: f.results.map((r) => r.roll) } }, select: { userId: true, rollNumber: true } });
  const userByRoll = new Map(profiles.map((p) => [p.rollNumber.toUpperCase(), p.userId]));

  let imported = 0;
  const skipped: { roll: string; reason: string }[] = [];
  for (const r of f.results) {
    const userId = userByRoll.get(r.roll.toUpperCase());
    if (!userId) { skipped.push({ roll: r.roll, reason: "No student with this roll number" }); continue; }
    if (await prisma.attempt.count({ where: { userId, labTestId: t.id } })) { skipped.push({ roll: r.roll, reason: "Already imported" }); continue; }
    let raw = 0, wrong = 0;
    const items = t.questionIds.map((qid, position) => {
      const q = byId.get(qid)!;
      const a = r.answers.find((x) => x.questionId === qid);
      if (q.type === "CODE") {
        const credit = a?.codeTotal ? (a.codePassed ?? 0) / a.codeTotal : 0;
        raw += credit;
        return { questionId: qid, position, optionOrder: [], chosen: [], code: a?.code ?? null, credit, correct: credit >= 1, codePassed: a?.codePassed ?? null, codeTotal: a?.codeTotal ?? null, timeSec: Math.round(a?.timeSec ?? 0) };
      }
      const chosen = (a?.chosen ?? []).filter((i) => i >= 0 && i < q.options.length);
      const g = gradeChoice(q.type, q.answers, chosen, partial);
      raw += g.credit;
      if (chosen.length && !g.correct) wrong++;
      return { questionId: qid, position, optionOrder: q.options.map((_, k) => k), chosen, credit: g.credit, correct: g.correct, timeSec: Math.round(a?.timeSec ?? 0) };
    });
    const total = t.questionIds.length;
    const score = total ? Math.round((100 * Math.max(0, raw - t.negativeMarking * wrong)) / total) : 0;
    await prisma.attempt.create({
      data: {
        userId, type: "LAB_TEST", label: t.title, labTestId: t.id, seat: r.seat ?? null, ip: r.ip ?? null,
        startedAt: new Date(r.startedAt), submittedAt: r.submittedAt ? new Date(r.submittedAt) : new Date(), total, correct: raw, score,
        tabSwitches: r.tabSwitches, fullscreenExits: r.fullscreenExits, flags: r.tabSwitches > 3 ? ["TAB_SWITCHING"] : [],
        items: { create: items },
      },
    });
    imported++;
  }
  await prisma.labTest.update({ where: { id: t.id }, data: { resultsImportedAt: new Date(), status: "CLOSED" } });
  return { imported, skipped };
}
