// Platform-wide numbers for the front page dashboard. Anonymous totals only, never one student's data.
import { prisma } from "./db";

export type LiveStats = {
  questions: number; mocks: number; mockAvg: number; readiness: number;
  practice: number; activeToday: number; answersToday: number;
  subj: { ps: number; prog: number; dsa: number };
  weakTopic: string; real: boolean;
};

const FALLBACK: LiveStats = { questions: 1850, mocks: 0, mockAvg: 0, readiness: 0, practice: 0, activeToday: 0, answersToday: 0, subj: { ps: 0, prog: 0, dsa: 0 }, weakTopic: "Analytical Reasoning", real: false };

export async function liveStats(): Promise<LiveStats> {
  try {
    const [q, m, p, a, s, w] = await Promise.all([
      // Unique questions only: a question saved twice is counted once.
      prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT regexp_replace(lower(text || coalesce(code, '')), '[^a-z0-9]', '', 'g'))::bigint AS n FROM "Question" WHERE status = 'LIVE'`,
      prisma.$queryRaw<{ n: bigint; avg: number | null }[]>`SELECT COUNT(*)::bigint AS n, AVG(score)::float AS avg FROM "Attempt" WHERE "submittedAt" IS NOT NULL AND type IN ('MOCK','NATIONAL_MOCK','DIAGNOSTIC')`,
      prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "Attempt" WHERE "submittedAt" IS NOT NULL AND type IN ('PRACTICE','MINI_MOCK')`,
      prisma.$queryRaw<{ users: bigint; answers: bigint }[]>`SELECT COUNT(DISTINCT a."userId")::bigint AS users, COUNT(i.id)::bigint AS answers FROM "Attempt" a LEFT JOIN "AttemptItem" i ON i."attemptId" = a.id AND i.correct IS NOT NULL WHERE a."startedAt" >= date_trunc('day', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi'`,
      prisma.$queryRaw<{ subject: string; acc: number }[]>`SELECT q.subject::text AS subject, AVG(CASE WHEN i.correct THEN 1 ELSE 0 END)::float * 100 AS acc FROM "AttemptItem" i JOIN "Question" q ON q.id = i."questionId" WHERE i.correct IS NOT NULL AND q.subject IN ('PS','PROG','DSA') GROUP BY q.subject`,
      prisma.$queryRaw<{ topic: string }[]>`SELECT q.topic FROM "AttemptItem" i JOIN "Question" q ON q.id = i."questionId" WHERE i.correct IS NOT NULL GROUP BY q.topic HAVING COUNT(*) >= 20 ORDER BY AVG(CASE WHEN i.correct THEN 1 ELSE 0 END) ASC LIMIT 1`,
    ]);
    const acc = (k: string) => Math.round(s.find((x) => x.subject === k)?.acc ?? 0);
    const mocks = Number(m[0]?.n ?? 0);
    const mockAvg = Math.round(m[0]?.avg ?? 0);
    const real = mocks > 0;
    return {
      questions: Number(q[0]?.n ?? 0) || FALLBACK.questions, mocks, mockAvg, readiness: mockAvg,
      practice: Number(p[0]?.n ?? 0), activeToday: Number(a[0]?.users ?? 0), answersToday: Number(a[0]?.answers ?? 0),
      subj: { ps: acc("PS"), prog: acc("PROG"), dsa: acc("DSA") },
      weakTopic: w[0]?.topic || FALLBACK.weakTopic, real,
    };
  } catch {
    const questions = await prisma.question.count({ where: { status: "LIVE" } }).catch(() => 0);
    return { ...FALLBACK, questions: questions || FALLBACK.questions };
  }
}
