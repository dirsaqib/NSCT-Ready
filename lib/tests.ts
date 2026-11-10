// Test engine. Questions are picked and graded on the server. Correct answers never reach the browser
// before submission. Supports single answer, multi-select, scenario and coding questions.
import type { AttemptType, Subject } from "@prisma/client";
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

const GRACE_SEC = 30;
const TIMED: AttemptType[] = ["DIAGNOSTIC", "MOCK", "MINI_MOCK", "NATIONAL_MOCK", "EMPLOYER_ASSESSMENT"];

export type StartOptions = { type: AttemptType; subject?: Subject; topic?: string; difficulty?: number; count?: number; assessmentCode?: string };

async function blueprint(key: string) {
  const b = await prisma.blueprint.findUnique({ where: { key } });
  if (b) return { counts: b.counts as Record<string, number>, difficulty: (b.difficulty ?? null) as Record<string, number> | null, durationMin: b.durationMin };
  const fb = BLUEPRINTS[key as keyof typeof BLUEPRINTS];
  return { counts: fb as Record<string, number>, difficulty: null, durationMin: Math.round((DURATION_SEC[key as AttemptType] ?? 3600) / 60) };
}

async function pick(subject: Subject, n: number, opts: { topic?: string; difficulty?: number; secure?: boolean; mix?: Record<string, number> | null }) {
  const rows = await prisma.question.findMany({
    where: { subject, status: "LIVE", ...(opts.secure === false ? { secure: false } : {}), ...(opts.topic ? { topic: opts.topic } : {}), ...(opts.difficulty ? { difficulty: opts.difficulty } : {}) },
    select: { id: true, difficulty: true },
  });
  if (!opts.mix) return shuffle(rows).slice(0, n).map((r) => r.id);
  const out: string[] = [];
  for (const [d, pct] of Object.entries(opts.mix)) out.push(...shuffle(rows.filter((r) => String(r.difficulty) === d)).slice(0, Math.round((n * pct) / 100)).map((r) => r.id));
  const rest = shuffle(rows.filter((r) => !out.includes(r.id))).map((r) => r.id);
  return [...out, ...rest].slice(0, n);
}

export async function startAttempt(userId: string, o: StartOptions, ctx: { ip?: string | null; device?: string | null } = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
  if (!user?.profile) throw new HttpError(400, "Please complete your profile first.");
  if (["MOCK", "NATIONAL_MOCK"].includes(o.type) && user.status === "PENDING")
    throw new HttpError(403, "Your university focal person has not verified your account yet. You can use the diagnostic and practice meanwhile.");

  if (o.type === "MOCK" && !(await hasPro(userId))) {
    const limit = await getSetting<number>("pricing.freeMockLimit");
    const used = await prisma.attempt.count({ where: { userId, type: "MOCK", label: null } });
    if (used >= limit) throw new HttpError(402, "You have used your free mock test. Get Pro access for unlimited mocks.", "PRO_REQUIRED");
  }

  let ids: string[] = [];
  let label: string | undefined;
  let durationMin: number | undefined;
  let windowId: string | undefined;
  let assessmentId: string | undefined;

  if (o.type === "DIAGNOSTIC" || o.type === "MOCK" || o.type === "NATIONAL_MOCK") {
    if (o.type === "NATIONAL_MOCK") {
      const now = new Date();
      const w = await prisma.testWindow.findFirst({ where: { opensAt: { lte: now }, closesAt: { gte: now }, OR: [{ universityId: null }, { universityId: user.universityId ?? "-" }] } });
      if (!w) throw new HttpError(409, "No national mock is open right now. Check the schedule.");
      if (await prisma.attempt.count({ where: { userId, windowId: w.id } })) throw new HttpError(409, "You have already taken this national mock.");
      windowId = w.id;
    }
    const bp = await blueprint(o.type);
    durationMin = bp.durationMin;
    for (const [s, n] of Object.entries(bp.counts)) ids.push(...(await pick(s as Subject, n, { secure: o.type === "NATIONAL_MOCK" ? undefined : false, mix: bp.difficulty })));
  } else if (o.type === "EMPLOYER_ASSESSMENT") {
    const a = await prisma.employerAssessment.findUnique({ where: { inviteCode: o.assessmentCode ?? "" } });
    if (!a) throw new HttpError(404, "Assessment not found.");
    if (await prisma.attempt.count({ where: { userId, assessmentId: a.id } })) throw new HttpError(409, "You have already taken this assessment.");
    assessmentId = a.id; label = a.title; durationMin = a.durationMin;
    for (const [s, n] of Object.entries(a.counts as Record<string, number>)) ids.push(...(await pick(s as Subject, n, { secure: false })));
  } else if (o.type === "MINI_MOCK" || o.type === "PRACTICE") {
    if (!o.subject) throw new HttpError(400, "Choose a subject.");
    ids = await pick(o.subject, o.type === "MINI_MOCK" ? 12 : Math.min(o.count ?? 10, 30), { topic: o.topic, difficulty: o.difficulty, secure: false });
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
      userId, type: o.type, label, windowId, assessmentId,
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
    include: { certificate: true, items: { orderBy: { position: "asc" }, include: { question: { include: { scenario: true } } } } },
  });
  if (!a) throw new HttpError(404, "Test not found.");
  const done = !!a.submittedAt;
  return {
    id: a.id, type: a.type, label: a.label, endsAt: a.endsAt, submitted: done, score: a.score, percentile: a.percentile,
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
  const ops = answers.map((ans) => {
    const it = byPos.get(ans.position);
    if (!it) throw new HttpError(400, "Unknown question.");
    return prisma.attemptItem.update({
      where: { id: it.id },
      data: { chosen: (ans.slots ?? []).map((s) => it.optionOrder[s]).filter((x) => x != null), code: ans.code?.slice(0, 20000), flagged: !!ans.flagged, timeSec: clampTime(ans.timeSec) },
    });
  });
  await prisma.$transaction([
    ...ops,
    prisma.attempt.update({ where: { id: a.id }, data: { lastSavedAt: new Date(), ...(tabSwitches != null ? { tabSwitches } : {}), ...(fullscreenExits != null ? { fullscreenExits } : {}) } }),
  ]);
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
export async function submitAttempt(userId: string, attemptId: string, answers: AnswerInput[], tabSwitches = 0, fullscreenExits = 0) {
  const a = await prisma.attempt.findFirst({ where: { id: attemptId, userId }, include: { items: { include: { question: true } } } });
  if (!a) throw new HttpError(404, "Test not found.");
  if (a.submittedAt) throw new HttpError(409, "This test was already submitted.");
  const late = !!a.endsAt && Date.now() > a.endsAt.getTime() + GRACE_SEC * 1000;
  const practice = a.type === "PRACTICE" || a.type === "MISTAKES";
  const partial = await getSetting<boolean>("test.multiSelectPartialCredit");
  const negative = await getSetting<number>("test.negativeMarking");
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

  await prisma.$transaction(async (tx) => {
    const perSubject = new Map<Subject, { c: number; t: number }>();
    const perTopic = new Map<string, { subject: Subject; topic: string; c: number; t: number }>();
    for (const g of counted) {
      await tx.attemptItem.update({
        where: { id: g.itemId },
        data: { chosen: g.chosen, code: g.code, correct: g.correct, credit: g.credit, flagged: g.flagged, timeSec: g.timeSec, ...(g.passed != null ? { codePassed: g.passed, codeTotal: g.total } : {}) },
      });
      await tx.question.update({ where: { id: g.questionId }, data: { timesSeen: { increment: 1 }, timesRight: { increment: g.correct ? 1 : 0 } } });
      const s = perSubject.get(g.subject) ?? { c: 0, t: 0 }; s.t++; s.c += g.credit; perSubject.set(g.subject, s);
      const k = `${g.subject}|${g.topic}`;
      const tp = perTopic.get(k) ?? { subject: g.subject, topic: g.topic, c: 0, t: 0 }; tp.t++; tp.c += g.credit; perTopic.set(k, tp);
      if (g.correct) await tx.mistake.deleteMany({ where: { userId, questionId: g.questionId } });
      else if (a.type !== "EMPLOYER_ASSESSMENT") await tx.mistake.upsert({ where: { userId_questionId: { userId, questionId: g.questionId } }, create: { userId, questionId: g.questionId }, update: { addedAt: new Date() } });
    }
    for (const [subject, v] of perSubject)
      await tx.mastery.upsert({ where: { userId_subject: { userId, subject } }, create: { userId, subject, correct: v.c, total: v.t }, update: { correct: { increment: v.c }, total: { increment: v.t } } });
    for (const v of perTopic.values())
      await tx.topicMastery.upsert({ where: { userId_subject_topic: { userId, subject: v.subject, topic: v.topic } }, create: { userId, subject: v.subject, topic: v.topic, correct: v.c, total: v.t }, update: { correct: { increment: v.c }, total: { increment: v.t } } });

    await tx.attempt.update({ where: { id: a.id }, data: { submittedAt: new Date(), total, correct: raw, score, tabSwitches: Math.max(a.tabSwitches, tabSwitches), fullscreenExits: Math.max(a.fullscreenExits, fullscreenExits) } });

    const mastery = await tx.mastery.findMany({ where: { userId } });
    const rd = readiness(Object.fromEntries(mastery.map((m) => [m.subject, m])));
    const p = await tx.profile.findUnique({ where: { userId } });
    if (p) {
      const st = nextStreak(p.lastActiveDay, p.streakDays);
      await tx.profile.update({
        where: { userId },
        data: { points: { increment: Math.round(raw * 10) }, streakDays: st.days, lastActiveDay: st.lastDay, readiness: rd.score, bestMock: (a.type === "MOCK" || a.type === "NATIONAL_MOCK") && !a.label && score > p.bestMock ? score : undefined },
      });
    }
  });

  if (!practice) { await percentileFor(a.id); await integrityFlags(a.id); }
  return { late, ...(await getAttemptForStudent(userId, attemptId)) };
}
