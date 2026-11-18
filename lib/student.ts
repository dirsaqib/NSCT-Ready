// Student journey: game-style preparation levels, the three fixed mocks, and guidance after each mock.
import { prisma } from "./db";
import { SUBJECTS } from "./syllabus";
import type { Subject } from "@prisma/client";

export const RANKS: [number, string][] = [[0, "Beginner"], [500, "Explorer"], [2000, "Achiever"], [5000, "Pro"], [10000, "NSCT Master"]];
export const stars = (best: number | null) => (best == null ? 0 : best >= 95 ? 3 : best >= 80 ? 2 : best >= 60 ? 1 : 0);
const levelLabel = (subject: string, topic: string) => `${subject} · ${topic}`;

/** Preparation map: every subject is a world, every topic a level. A level opens when the one before has a star. */
export async function preparation(userId: string, universityId: string | null) {
  const [topicRows, attempts, profile] = await Promise.all([
    prisma.question.groupBy({
      by: ["subject", "topic"],
      where: { status: "LIVE", OR: [{ scope: "NATIONAL" }, ...(universityId ? [{ scope: "UNIVERSITY" as const, authorUniversityId: universityId }] : [])] },
      _count: true,
    }),
    prisma.attempt.findMany({ where: { userId, submittedAt: { not: null }, type: { in: ["PRACTICE", "MINI_MOCK"] } }, select: { type: true, label: true, score: true, correct: true, submittedAt: true } }),
    prisma.profile.findUnique({ where: { userId }, select: { streakDays: true } }),
  ]);
  const best = new Map<string, number>();
  for (const a of attempts) if (a.label) best.set(`${a.type}|${a.label}`, Math.max(best.get(`${a.type}|${a.label}`) ?? 0, a.score));
  const xp = attempts.reduce((n, a) => n + a.correct * 10, 0) + [...best.values()].reduce((n, b) => n + stars(b) * 50, 0);
  const rank = [...RANKS].reverse().find(([min]) => xp >= min)![1];
  const next = RANKS.find(([min]) => min > xp);

  const worlds = SUBJECTS.map((s) => {
    const topics = topicRows.filter((t) => t.subject === s.key).sort((a, b) => b._count - a._count || a.topic.localeCompare(b.topic));
    let open = true;
    const levels = topics.map((t, i) => {
      const b = best.get(`PRACTICE|${levelLabel(s.key, t.topic)}`) ?? null;
      const lv = { n: i + 1, topic: t.topic, questions: t._count, best: b, stars: stars(b), unlocked: open };
      open = lv.stars > 0;
      return lv;
    });
    const starred = levels.filter((l) => l.stars > 0).length;
    const bossBest = best.get(`MINI_MOCK|${s.key}`) ?? null;
    return {
      key: s.key, name: s.name, short: s.short, weight: s.weight, levels,
      done: starred, total: levels.length, stars: levels.reduce((n, l) => n + l.stars, 0),
      boss: { unlocked: levels.length > 0 && starred >= Math.ceil(levels.length * 0.6), best: bossBest, stars: stars(bossBest) },
    };
  });
  return { xp, rank, nextRank: next ? { name: next[1], at: next[0] } : null, streak: profile?.streakDays ?? 0, played: attempts.length, worlds };
}

/** The three fixed mocks: whether each is open, best and last score, and guidance from the latest one. */
export async function mocks(userId: string, universityId: string | null) {
  const att = await prisma.attempt.findMany({
    where: { userId, type: "MOCK", label: { in: ["Mock 1", "Mock 2", "Mock 3"] }, submittedAt: { not: null } },
    orderBy: { submittedAt: "desc" }, select: { id: true, label: true, score: true, submittedAt: true },
  });
  const list = [1, 2, 3].map((n) => {
    const mine = att.filter((a) => a.label === `Mock ${n}`);
    const prevDone = n === 1 || att.some((a) => a.label === `Mock ${n - 1}`);
    return { n, unlocked: prevDone, attempts: mine.length, best: mine.length ? Math.max(...mine.map((a) => a.score)) : null, last: mine[0] ?? null };
  });
  const latest = att[0] ? await guidance(att[0].id) : null;
  const uniQuestions = universityId ? await prisma.question.count({ where: { status: "LIVE", scope: "UNIVERSITY", authorUniversityId: universityId } }) : 0;
  return { mocks: list, latest: latest && { attemptId: att[0].id, label: att[0].label, score: att[0].score, ...latest }, uniQuestions };
}

/** What to study and what to skip, from one mock attempt. Ranked by how many marks each subject can still add. */
export async function guidance(attemptId: string) {
  const items = await prisma.attemptItem.findMany({ where: { attemptId }, select: { correct: true, question: { select: { subject: true, topic: true } } } });
  const by = new Map<Subject, { right: number; total: number; wrongTopics: Map<string, number> }>();
  for (const it of items) {
    const s = it.question.subject;
    const r = by.get(s) ?? { right: 0, total: 0, wrongTopics: new Map() };
    r.total++;
    if (it.correct) r.right++;
    else r.wrongTopics.set(it.question.topic, (r.wrongTopics.get(it.question.topic) ?? 0) + 1);
    by.set(s, r);
  }
  const subjects = SUBJECTS.filter((s) => by.has(s.key)).map((s) => {
    const r = by.get(s.key)!;
    const acc = Math.round((100 * r.right) / r.total);
    return { key: s.key, name: s.name, weight: s.weight, acc, gain: Math.round((s.weight * (100 - acc)) / 100), topics: [...r.wrongTopics.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 4) };
  });
  return {
    subjects,
    study: subjects.filter((s) => s.acc < 90).sort((a, b) => b.gain - a.gain),
    skip: subjects.filter((s) => s.acc >= 90),
  };
}

/** What a student did to prepare, for their focal person and the super admin. */
export async function activity(userId: string) {
  const [attempts, videos, profile] = await Promise.all([
    prisma.attempt.findMany({ where: { userId, submittedAt: { not: null } }, orderBy: { submittedAt: "desc" }, take: 100, select: { id: true, type: true, label: true, score: true, correct: true, total: true, startedAt: true, submittedAt: true, tabSwitches: true } }),
    prisma.auditLog.findMany({ where: { actorId: userId, action: "study.video" }, orderBy: { createdAt: "desc" }, take: 50, select: { target: true, createdAt: true } }),
    prisma.profile.findUnique({ where: { userId }, select: { streakDays: true, readiness: true, bestMock: true, lastActiveDay: true } }),
  ]);
  const vids = await prisma.studyVideo.findMany({ where: { id: { in: videos.map((v) => v.target ?? "") } }, select: { id: true, title: true, subject: true } });
  const minutes = Math.round(attempts.reduce((n, a) => n + (a.submittedAt!.getTime() - a.startedAt.getTime()) / 60000, 0));
  return {
    summary: {
      tests: attempts.length, prepSessions: attempts.filter((a) => a.type === "PRACTICE" || a.type === "MINI_MOCK").length,
      mocks: attempts.filter((a) => a.type === "MOCK").length, minutes, videos: videos.length, ...profile,
    },
    attempts: attempts.map((a) => ({ ...a, minutes: Math.round((a.submittedAt!.getTime() - a.startedAt.getTime()) / 60000) })),
    videos: videos.map((v) => ({ at: v.createdAt, video: vids.find((x) => x.id === v.target) ?? null })),
  };
}
