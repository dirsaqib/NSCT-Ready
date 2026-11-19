// Test engine. Questions are picked and graded on the server. Correct answers never reach the browser
// before submission. Supports single answer, multi-select, scenario and coding questions.
import type { AttemptType, Subject } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { HttpError } from "./errors";
import { BLUEPRINTS, DURATION_SEC } from "./syllabus";
import { nextStreak, readiness, shuffle } from "./scoring";
import { getSetting } from "./settings";
import { runTests, type CodeTest } from "./coderunner";
import { integrityFlags, percentileFor } from "./integrity";
import { hasPro } from "./payments";
import { sha256 } from "./crypto";
import { labStartCheck } from "./labtests";

const GRACE_SEC = 30;
const TIMED: AttemptType[] = ["DIAGNOSTIC", "MOCK", "MINI_MOCK", "NATIONAL_MOCK", "EMPLOYER_ASSESSMENT", "LAB_TEST"];

export type StartOptions = { type: AttemptType; subject?: Subject; topic?: string; difficulty?: number; count?: number; assessmentCode?: string; labTestId?: string; accessCode?: string; seat?: string; mockNo?: number; universityOnly?: boolean };

async function blueprint(key: string) {
  const b = await prisma.blueprint.findUnique({ where: { key } });
  if (b) return { counts: b.counts as Record<string, number>, difficulty: (b.difficulty ?? null) as Record<string, number> | null, durationMin: b.durationMin };
  const fb = BLUEPRINTS[key as keyof typeof BLUEPRINTS];
  return { counts: fb as Record<string, number>, difficulty: null, durationMin: Math.round((DURATION_SEC[key as AttemptType] ?? 3600) / 60) };
}

async function pick(subject: Subject, n: number, opts: { topic?: string; difficulty?: number; secure?: boolean; mix?: Record<string, number> | null; universityId?: string | null; exclude?: Set<string> }) {
  // The national bank, plus questions the student's own university added for its students only.
  const scope = opts.universityId ? { OR: [{ scope: "NATIONAL" as const }, { scope: "UNIVERSITY" as const, authorUniversityId: opts.universityId }] } : { scope: "NATIONAL" as const };
  const all = await prisma.question.findMany({
    where: { subject, status: "LIVE", ...scope, ...(opts.secure === false ? { secure: false } : {}), ...(opts.topic ? { topic: opts.topic } : {}), ...(opts.difficulty ? { difficulty: opts.difficulty } : {}) },
    select: { id: true, difficulty: true },
  });
  // Random for every student, and questions this student has not seen yet come first.
  const ex = opts.exclude;
  const rows = ex ? [...shuffle(all.filter((r) => !ex.has(r.id))), ...shuffle(all.filter((r) => ex.has(r.id)))] : shuffle(all);
  if (!opts.mix) return rows.slice(0, n).map((r) => r.id);
  const out: string[] = [];
  for (const [d, pct] of Object.entries(opts.mix)) out.push(...rows.filter((r) => String(r.difficulty) === d).slice(0, Math.round((n * pct) / 100)).map((r) => r.id));
  const rest = rows.filter((r) => !out.includes(r.id)).map((r) => r.id);
  return shuffle([...out, ...rest.slice(0, Math.max(0, n - out.length))]).slice(0, n);
}

/** Questions this student has already been given, so new papers prefer fresh ones. */
async function seenBy(userId: string, types?: AttemptType[]) {
  const rows = await prisma.attemptItem.findMany({ where: { attempt: { userId, ...(types ? { type: { in: types } } : {}) } }, select: { questionId: true }, take: 20000 });
  return new Set(rows.map((r) => r.questionId));
}

// Mock 1 is the gentlest and Mock 3 the hardest, so students can see themselves improve.
const MOCK_MIX: Record<number, Record<string, number>> = { 1: { "1": 40, "2": 45, "3": 15 }, 2: { "1": 25, "2": 50, "3": 25 }, 3: { "1": 10, "2": 45, "3": 45 } };

/** The fixed paper for Mock 1, 2 or 3. Built from the national bank the first time anyone opens it. */
export async function mockPaper(n: number) {
  const have = await prisma.mockPaper.findUnique({ where: { number: n } });
  if (have?.questionIds.length) return have;
  const bp = await blueprint("MOCK");
  const used = new Set((await prisma.mockPaper.findMany({ select: { questionIds: true } })).flatMap((p) => p.questionIds));
  const ids: string[] = [];
  for (const [s, count] of Object.entries(bp.counts)) {
    const rows = await prisma.question.findMany({ where: { subject: s as Subject, status: "LIVE", scope: "NATIONAL", secure: false }, select: { id: true, difficulty: true } });
    const fresh = rows.filter((r) => !used.has(r.id));
    const pool = fresh.length >= count ? fresh : rows; // reuse only when the bank is too small
    const out: string[] = [];
    for (const [d, pct] of Object.entries(MOCK_MIX[n] ?? MOCK_MIX[2])) out.push(...shuffle(pool.filter((r) => String(r.difficulty) === d)).slice(0, Math.round((count * pct) / 100)).map((r) => r.id));
    out.push(...shuffle(pool.filter((r) => !out.includes(r.id))).map((r) => r.id));
    ids.push(...out.slice(0, count));
  }
  return prisma.mockPaper.upsert({ where: { number: n }, create: { number: n, questionIds: ids, durationMin: bp.durationMin }, update: { questionIds: ids, durationMin: bp.durationMin } });
}

export async function startAttempt(userId: string, o: StartOptions, ctx: { ip?: string | null; device?: string | null } = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
  if (!user?.profile) throw new HttpError(400, "Please complete your profile first.");
  if (["MOCK", "NATIONAL_MOCK"].includes(o.type) && user.status === "PENDING")
    throw new HttpError(403, "Your university focal person has not verified your account yet. You can use the diagnostic and practice meanwhile.");

  if (o.type === "MOCK" && o.mockNo) {
    if (o.mockNo > 1 && !(await prisma.attempt.count({ where: { userId, type: "MOCK", label: `Mock ${o.mockNo - 1}`, submittedAt: { not: null } } })))
      throw new HttpError(409, `Finish Mock ${o.mockNo - 1} first.`);
  } else if (o.type === "MOCK" && !(await hasPro(userId))) {
    const limit = await getSetting<number>("pricing.freeMockLimit");
    const used = await prisma.attempt.count({ where: { userId, type: "MOCK", label: null } });
    if (used >= limit) throw new HttpError(402, "You have used your free mock test. Get Pro access for unlimited mocks.", "PRO_REQUIRED");
  }

  let ids: string[] = [];
  let label: string | undefined;
  let durationMin: number | undefined;
  let windowId: string | undefined;
  let assessmentId: string | undefined;
  let labTestId: string | undefined;

  if (o.type === "MOCK" && o.mockNo) {
    // Every student gets their own random paper with the same subject weights and difficulty level,
    // so neighbours see different questions. Questions from the student's earlier mocks are avoided.
    const bp = await blueprint("MOCK");
    const seen = await seenBy(userId, ["MOCK"]);
    for (const [s, n] of Object.entries(bp.counts)) ids.push(...(await pick(s as Subject, n, { secure: false, mix: MOCK_MIX[o.mockNo] ?? MOCK_MIX[2], exclude: seen, universityId: user.universityId })));
    ids = shuffle(ids); // a different order for every student too
    durationMin = bp.durationMin;
    label = `Mock ${o.mockNo}`;
  } else if (o.type === "DIAGNOSTIC" || o.type === "MOCK" || o.type === "NATIONAL_MOCK") {
    if (o.type === "NATIONAL_MOCK") {
      const now = new Date();
      const w = await prisma.testWindow.findFirst({ where: { opensAt: { lte: now }, closesAt: { gte: now }, OR: [{ universityId: null }, { universityId: user.universityId ?? "-" }] } });
      if (!w) throw new HttpError(409, "No national mock is open right now. Check the schedule.");
      if (await prisma.attempt.count({ where: { userId, windowId: w.id } })) throw new HttpError(409, "You have already taken this national mock.");
      windowId = w.id;
    }
    const bp = await blueprint(o.type);
    durationMin = bp.durationMin;
    for (const [s, n] of Object.entries(bp.counts)) ids.push(...(await pick(s as Subject, n, { secure: o.type === "NATIONAL_MOCK" ? undefined : false, mix: bp.difficulty, universityId: o.type === "MOCK" ? user.universityId : null })));
  } else if (o.type === "EMPLOYER_ASSESSMENT") {
    const a = await prisma.employerAssessment.findUnique({ where: { inviteCode: o.assessmentCode ?? "" } });
    if (!a) throw new HttpError(404, "Assessment not found.");
    if (await prisma.attempt.count({ where: { userId, assessmentId: a.id } })) throw new HttpError(409, "You have already taken this assessment.");
    assessmentId = a.id; label = a.title; durationMin = a.durationMin;
    for (const [s, n] of Object.entries(a.counts as Record<string, number>)) ids.push(...(await pick(s as Subject, n, { secure: false, universityId: user.universityId })));
  } else if (o.type === "LAB_TEST") {
    const lab = await labStartCheck(userId, o.labTestId ?? "", o.accessCode ?? "", ctx.ip);
    labTestId = lab.test.id; label = lab.test.title; durationMin = lab.durationMin; ids = lab.ids as string[];
  } else if (o.type === "PRACTICE" && o.universityOnly) {
    // University test: only the questions the student's own university added for its students.
    if (!user.universityId) throw new HttpError(400, "Your account has no university.");
    const rows = await prisma.question.findMany({ where: { status: "LIVE", scope: "UNIVERSITY", authorUniversityId: user.universityId, ...(o.subject ? { subject: o.subject } : {}) }, select: { id: true } });
    ids = shuffle(rows.map((r) => r.id)).slice(0, Math.min(o.count ?? 20, 30));
    label = "University test";
    durationMin = Math.max(10, ids.length);
  } else if (o.type === "MINI_MOCK" || o.type === "PRACTICE") {
    if (!o.subject) throw new HttpError(400, "Choose a subject.");
    const seen = await seenBy(userId, ["PRACTICE", "MINI_MOCK"]);
    ids = await pick(o.subject, o.type === "MINI_MOCK" ? 12 : Math.min(o.count ?? 10, 30), { topic: o.topic, difficulty: o.difficulty, secure: false, universityId: user.universityId, exclude: seen });
    label = [o.subject, o.topic, o.difficulty ? `level ${o.difficulty}` : ""].filter(Boolean).join(" · ");
    if (o.type === "MINI_MOCK") durationMin = 15;
  } else if (o.type === "MISTAKES") {
    const m = await prisma.mistake.findMany({ where: { userId }, select: { questionId: true }, take: 200 });
    ids = shuffle(m.map((x) => x.questionId)).slice(0, 20);
  }
  if (!ids.length) throw new HttpError(404, "No questions are available for this selection yet.");

  // Accommodation: extra time set by the focal person.
  const extra = user.profile.extraTimePct ?? 0;
  const secs = durationMin && TIMED.includes(o.type) ? Math.round(durationMin * 60 * (1 + extra / 100)) : null;

  const qs = await prisma.question.findMany({ where: { id: { in: ids } }, select: { id: true, type: true, options: true } });
  const byId = new Map(qs.map((q) => [q.id, q]));
  const attempt = await prisma.attempt.create({
    data: {
      userId, type: o.type, label, windowId, assessmentId, labTestId, seat: o.seat?.slice(0, 20) ?? null,
      endsAt: secs ? new Date(Date.now() + secs * 1000) : null,
      ip: ctx.ip ?? null,
      deviceHash: ctx.device ? sha256(ctx.device) : null,
      items: {
        create: ids.map((qid, i) => {
          const q = byId.get(qid)!;
          return { questionId: qid, position: i, optionOrder: q.type === "CODE" ? [] : shuffle(q.options.map((_, k) => k)), chosen: [] };
        }),
      },
    },
  });
  if (user.status === "VERIFIED") await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
  return getAttemptForStudent(userId, attempt.id);
}

/** What the browser receives during a test: shuffled options, no answers, no hidden tests. */
export async function getAttemptForStudent(userId: string, attemptId: string) {
  const a = await prisma.attempt.findFirst({
    where: { id: attemptId, userId },
    include: { certificate: true, labTest: { select: { resultsReleased: true } }, items: { orderBy: { position: "asc" }, include: { question: { include: { scenario: true } } } } },
  });
  if (!a) throw new HttpError(404, "Test not found.");
  // Lab test results stay hidden until the department releases them.
  const done = !!a.submittedAt && (!a.labTest || a.labTest.resultsReleased);
  return {
    id: a.id, type: a.type, label: a.label, endsAt: a.endsAt, submitted: !!a.submittedAt, resultsHidden: !!a.submittedAt && !done, score: done ? a.score : null, percentile: a.percentile,
    flags: done ? a.flags : [], certificate: a.certificate?.code ?? null,
    items: a.items.map((it) => {
      const q = it.question;
      const tests = (q.tests as CodeTest[] | null) ?? [];
      return {
        position: it.position, questionId: q.id, type: q.type, subject: q.subject, topic: q.topic, text: q.text, code: q.code,
        scenario: q.scenario ? { title: q.scenario.title, passage: q.scenario.passage } : null,
        multi: q.type === "MULTI", selectCount: q.type === "MULTI" ? q.answers.length : 1,
        options: it.optionOrder.map((oi) => q.options[oi]),
        chosenSlots: it.chosen.map((c) => it.optionOrder.indexOf(c)),
        language: q.language, starterCode: q.starterCode, sampleTests: tests.filter((t) => !t.hidden).map((t) => ({ input: t.input, expected: t.expected })),
        codeAnswer: it.code, flagged: it.flagged,
        ...(done
          ? { correctSlots: q.answers.map((x) => it.optionOrder.indexOf(x)), explanation: q.explanation, correct: it.correct, credit: it.credit, codePassed: it.codePassed, codeTotal: it.codeTotal, timeSec: it.timeSec }
          : {}),
      };
    }),
  };
}

export const AnswerSchema = z.object({
  position: z.number().int().min(0),
  slots: z.array(z.number().int().min(0).max(5)).max(6).optional(),
  code: z.string().max(20000).optional(),
  flagged: z.boolean().optional(),
  timeSec: z.number().optional(),
});
export type AnswerInput = z.infer<typeof AnswerSchema>;

const clampTime = (t?: number) => Math.max(0, Math.min(3600, Math.round(t ?? 0)));

/** Auto-save during a test. Called every few seconds and after reconnecting. */
export async function saveProgress(userId: string, attemptId: string, answers: AnswerInput[], tabSwitches?: number, fullscreenExits?: number) {
  const a = await prisma.attempt.findFirst({ where: { id: attemptId, userId }, include: { items: true } });
  if (!a || a.submittedAt) throw new HttpError(409, "This test is already submitted.");
  if (a.endsAt && Date.now() > a.endsAt.getTime() + GRACE_SEC * 1000) throw new HttpError(409, "Time is up.");
  const byPos = new Map(a.items.map((i) => [i.position, i]));
  // One bulk update instead of one query per answer.
  const rows = answers.map((ans) => {
    const it = byPos.get(ans.position);
    if (!it) throw new HttpError(400, "Unknown question.");
    const chosen = (ans.slots ?? []).map((x) => it.optionOrder[x]).filter((x) => x != null);
    return Prisma.sql`(${it.id}::text, ${chosen}::int[], ${ans.code?.slice(0, 20000) ?? null}::text, ${!!ans.flagged}::boolean, ${clampTime(ans.timeSec)}::int)`;
  });
  if (rows.length) await prisma.$executeRaw`UPDATE "AttemptItem" AS t SET "chosen" = v.chosen, "code" = v.code, "flagged" = v.flagged, "timeSec" = v.ts FROM (VALUES ${Prisma.join(rows)}) AS v(id, chosen, code, flagged, ts) WHERE t.id = v.id`;
  await prisma.attempt.update({ where: { id: a.id }, data: { lastSavedAt: new Date(), ...(tabSwitches != null ? { tabSwitches } : {}), ...(fullscreenExits != null ? { fullscreenExits } : {}) } });
  return { savedAt: new Date() };
}

export function gradeChoice(type: string, answers: number[], chosen: number[], partial: boolean) {
  if (!chosen.length) return { correct: false, credit: 0 };
  if (type !== "MULTI") return { correct: chosen[0] === answers[0], credit: chosen[0] === answers[0] ? 1 : 0 };
  const set = new Set(answers);
  const exact = chosen.length === answers.length && chosen.every((c) => set.has(c));
  if (exact) return { correct: true, credit: 1 };
  if (!partial || chosen.some((c) => !set.has(c))) return { correct: false, credit: 0 };
  return { correct: false, credit: chosen.length / answers.length };
}

/** Practice mode: check one answer immediately. */
export async function checkPracticeAnswer(userId: string, attemptId: string, ans: AnswerInput) {
  const a = await prisma.attempt.findFirst({ where: { id: attemptId, userId }, select: { type: true, submittedAt: true } });
  if (!a || a.submittedAt) throw new HttpError(404, "Practice session not found.");
  if (a.type !== "PRACTICE" && a.type !== "MISTAKES") throw new HttpError(400, "Answers are shown after you submit the test.");
  const it = await prisma.attemptItem.findUnique({ where: { attemptId_position: { attemptId, position: ans.position } }, include: { question: true } });
  if (!it) throw new HttpError(404, "Question not found.");
  const q = it.question;
  let correct: boolean, credit: number;
  let run = null;
  if (q.type === "CODE") {
    run = await runTests(q.language ?? "python", ans.code ?? "", (q.tests as CodeTest[]) ?? []);
    credit = run.total ? run.passed / run.total : 0;
    correct = run.total > 0 && run.passed === run.total;
    await prisma.attemptItem.update({ where: { id: it.id }, data: { code: ans.code, codePassed: run.passed, codeTotal: run.total, timeSec: clampTime(ans.timeSec) } });
  } else {
    const chosen = (ans.slots ?? []).map((s) => it.optionOrder[s]);
    ({ correct, credit } = gradeChoice(q.type, q.answers, chosen, await getSetting<boolean>("test.multiSelectPartialCredit")));
    await prisma.attemptItem.update({ where: { id: it.id }, data: { chosen, timeSec: clampTime(ans.timeSec) } });
  }
  return { correct, credit, correctSlots: q.answers.map((x) => it.optionOrder.indexOf(x)), explanation: q.explanation, run };
}

/** Run visible sample tests while writing code. Hidden tests run only at submit. */
export async function runSample(userId: string, attemptId: string, position: number, code: string) {
  const it = await prisma.attemptItem.findUnique({ where: { attemptId_position: { attemptId, position } }, include: { question: true, attempt: true } });
  if (!it || it.attempt.userId !== userId || it.attempt.submittedAt) throw new HttpError(404, "Question not found.");
  if (it.question.type !== "CODE") throw new HttpError(400, "Not a coding question.");
  const tests = ((it.question.tests as CodeTest[]) ?? []).filter((t) => !t.hidden);
  return runTests(it.question.language ?? "python", code, tests);
}

type Graded = { itemId: string; position: number; questionId: string; subject: Subject; topic: string; chosen: number[]; code: string | null; correct: boolean; credit: number; answered: boolean; passed?: number; total?: number; flagged: boolean; timeSec: number };

/** Grade and save. Answers after the deadline (plus grace) are refused and the last auto-save is used. */
export async function submitAttempt(userId: string, attemptId: string, answers: AnswerInput[], tabSwitches = 0, fullscreenExits = 0, reason?: string) {
  const a = await prisma.attempt.findFirst({ where: { id: attemptId, userId }, include: { items: { include: { question: true } } } });
  if (!a) throw new HttpError(404, "Test not found.");
  if (a.submittedAt) throw new HttpError(409, "This test was already submitted.");
  const late = !!a.endsAt && Date.now() > a.endsAt.getTime() + GRACE_SEC * 1000;
  const practice = a.type === "PRACTICE" || a.type === "MISTAKES";
  const partial = await getSetting<boolean>("test.multiSelectPartialCredit");
  const lab = a.labTestId ? await prisma.labTest.findUnique({ where: { id: a.labTestId } }) : null;
  const negative = lab ? lab.negativeMarking : await getSetting<number>("test.negativeMarking");
  const byPos = new Map(answers.map((x) => [x.position, x]));

  // Grade outside the transaction because code runs can take a few seconds.
  const graded: Graded[] = [];
  for (const it of a.items) {
    const ans = late ? undefined : byPos.get(it.position);
    const chosen = ans?.slots ? ans.slots.map((s) => it.optionOrder[s]).filter((x) => x != null) : it.chosen;
    const code = ans?.code ?? it.code ?? "";
    const q = it.question;
    const base = { itemId: it.id, position: it.position, questionId: q.id, subject: q.subject, topic: q.topic, flagged: !!ans?.flagged || it.flagged, timeSec: clampTime(ans?.timeSec ?? it.timeSec) };
    if (q.type === "CODE") {
      if (!code.trim()) { graded.push({ ...base, chosen: [], code: null, correct: false, credit: 0, answered: false }); continue; }
      const r = await runTests(q.language ?? "python", code, (q.tests as CodeTest[]) ?? []).catch(() => ({ passed: 0, total: 0 }));
      graded.push({ ...base, chosen: [], code, correct: r.total > 0 && r.passed === r.total, credit: r.total ? r.passed / r.total : 0, answered: true, passed: r.passed, total: r.total });
    } else {
      graded.push({ ...base, chosen, code: null, ...gradeChoice(q.type, q.answers, chosen, partial), answered: chosen.length > 0 });
    }
  }
  const counted = practice ? graded.filter((g) => g.answered) : graded;
  const wrong = counted.filter((g) => g.answered && !g.correct).length;
  const raw = Math.max(0, counted.reduce((s, g) => s + g.credit, 0) - negative * wrong);
  const total = counted.length;
  const score = total ? Math.round((100 * raw) / total) : 0;

  // Few, bulk queries: the database is far from the server, so one query per answer timed out on long tests.
  const perSubject = new Map<Subject, { c: number; t: number }>();
  const perTopic = new Map<string, { subject: Subject; topic: string; c: number; t: number }>();
  for (const g of counted) {
    const s = perSubject.get(g.subject) ?? { c: 0, t: 0 }; s.t++; s.c += g.credit; perSubject.set(g.subject, s);
    const k = `${g.subject}|${g.topic}`;
    const tp = perTopic.get(k) ?? { subject: g.subject, topic: g.topic, c: 0, t: 0 }; tp.t++; tp.c += g.credit; perTopic.set(k, tp);
  }
  const rightIds = counted.filter((g) => g.correct).map((g) => g.questionId);
  const wrongIds = counted.filter((g) => !g.correct).map((g) => g.questionId);

  await prisma.$transaction(async (tx) => {
    if (counted.length) {
      const rows = counted.map((g) => Prisma.sql`(${g.itemId}::text, ${g.chosen}::int[], ${g.code}::text, ${g.correct}::boolean, ${g.credit}::float8, ${g.flagged}::boolean, ${g.timeSec}::int, ${g.passed ?? null}::int, ${g.total ?? null}::int)`);
      await tx.$executeRaw`UPDATE "AttemptItem" AS t SET "chosen" = v.chosen, "code" = v.code, "correct" = v.correct, "credit" = v.credit, "flagged" = v.flagged, "timeSec" = v.ts, "codePassed" = COALESCE(v.cp, t."codePassed"), "codeTotal" = COALESCE(v.ct, t."codeTotal") FROM (VALUES ${Prisma.join(rows)}) AS v(id, chosen, code, correct, credit, flagged, ts, cp, ct) WHERE t.id = v.id`;
      await tx.question.updateMany({ where: { id: { in: counted.map((g) => g.questionId) } }, data: { timesSeen: { increment: 1 } } });
      if (rightIds.length) {
        await tx.question.updateMany({ where: { id: { in: rightIds } }, data: { timesRight: { increment: 1 } } });
        await tx.mistake.deleteMany({ where: { userId, questionId: { in: rightIds } } });
      }
      if (wrongIds.length && a.type !== "EMPLOYER_ASSESSMENT") {
        await tx.mistake.updateMany({ where: { userId, questionId: { in: wrongIds } }, data: { addedAt: new Date() } });
        await tx.mistake.createMany({ data: wrongIds.map((questionId) => ({ userId, questionId })), skipDuplicates: true });
      }
      const ms = [...perSubject].map(([subject, v]) => Prisma.sql`(${userId}, ${subject}::"Subject", ${v.c}::float8, ${v.t}::int)`);
      await tx.$executeRaw`INSERT INTO "Mastery" ("userId", "subject", "correct", "total") VALUES ${Prisma.join(ms)} ON CONFLICT ("userId", "subject") DO UPDATE SET "correct" = "Mastery"."correct" + EXCLUDED."correct", "total" = "Mastery"."total" + EXCLUDED."total"`;
      const ts = [...perTopic.values()].map((v) => Prisma.sql`(${userId}, ${v.subject}::"Subject", ${v.topic}, ${v.c}::float8, ${v.t}::int)`);
      await tx.$executeRaw`INSERT INTO "TopicMastery" ("userId", "subject", "topic", "correct", "total") VALUES ${Prisma.join(ts)} ON CONFLICT ("userId", "subject", "topic") DO UPDATE SET "correct" = "TopicMastery"."correct" + EXCLUDED."correct", "total" = "TopicMastery"."total" + EXCLUDED."total"`;
    }

    await tx.attempt.update({ where: { id: a.id }, data: { submittedAt: new Date(), total, correct: raw, score, tabSwitches: Math.max(a.tabSwitches, tabSwitches), fullscreenExits: Math.max(a.fullscreenExits, fullscreenExits) } });

    const mastery = await tx.mastery.findMany({ where: { userId } });
    const rd = readiness(Object.fromEntries(mastery.map((m) => [m.subject, m])));
    const p = await tx.profile.findUnique({ where: { userId } });
    if (p) {
      const st = nextStreak(p.lastActiveDay, p.streakDays);
      await tx.profile.update({
        where: { userId },
        data: { points: { increment: Math.round(raw * 10) }, streakDays: st.days, lastActiveDay: st.lastDay, readiness: rd.score, bestMock: (a.type === "MOCK" || a.type === "NATIONAL_MOCK") && (!a.label || /^Mock [123]$/.test(a.label)) && score > p.bestMock ? score : undefined },
      });
    }
  }, { maxWait: 10000, timeout: 30000 });

  if (!practice) { await percentileFor(a.id).catch(() => null); await integrityFlags(a.id).catch(() => null); }
  // Locked-mode tests: record why the test was submitted automatically.
  if (reason) {
    const cur = await prisma.attempt.findUnique({ where: { id: a.id }, select: { flags: true } });
    await prisma.attempt.update({ where: { id: a.id }, data: { flags: [...new Set([...(cur?.flags ?? []), `AUTO_SUBMITTED_${reason}`])] } });
  }
  return { late, ...(await getAttemptForStudent(userId, attemptId)) };
}

/**
 * Timed tests that were abandoned (browser closed, battery died) are submitted with whatever answers
 * were saved, once their time plus grace has passed. Called when the student next opens the app.
 */
export async function finalizeExpired(userId: string) {
  const open = await prisma.attempt.findMany({ where: { userId, submittedAt: null, endsAt: { lt: new Date(Date.now() - GRACE_SEC * 1000) } }, select: { id: true }, take: 5 });
  for (const o of open) await submitAttempt(userId, o.id, [], 0, 0, "TIME_ENDED").catch(() => null);
}
