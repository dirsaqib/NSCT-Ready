// AI coach: personal guidance from a student's own results. The rules always work. When an AI key is set,
// the model rewrites the plan in friendlier words, but the facts it uses come only from these numbers.
import { prisma } from "./db";
import { SUBJECTS } from "./syllabus";

export type CoachData = {
  name: string; readiness: number; bestMock: number; tests: number; daysToExam: number;
  subjects: { key: string; name: string; weight: number; acc: number | null; answered: number }[];
  weakTopics: { subject: string; topic: string; acc: number; answered: number }[];
  strongTopics: { subject: string; topic: string; acc: number; answered: number }[];
  recent: { type: string; score: number; date: Date }[];
  trend: number | null; integrityFlags: number;
};

export type CoachAdviceT = { headline: string; summary: string; focus: { title: string; why: string; action: string }[]; weekPlan: string[]; source: "rules" | "ai" };

const EXAM = new Date("2027-01-23T09:00:00+05:00");

/** Everything the coach and the detailed report need about one student. */
export async function coachData(userId: string): Promise<CoachData | null> {
  const [p, mastery, topics, attempts] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.mastery.findMany({ where: { userId } }),
    prisma.topicMastery.findMany({ where: { userId, total: { gte: 3 } } }),
    prisma.attempt.findMany({ where: { userId, submittedAt: { not: null } }, orderBy: { submittedAt: "desc" }, take: 30, select: { type: true, score: true, submittedAt: true, flags: true, tabSwitches: true } }),
  ]);
  if (!p) return null;
  const subjects = SUBJECTS.map((s) => {
    const m = mastery.find((x) => x.subject === s.key);
    return { key: s.key, name: s.name, weight: s.weight, acc: m?.total ? Math.round((100 * m.correct) / m.total) : null, answered: m?.total ?? 0 };
  });
  const tp = topics.map((t) => ({ subject: SUBJECTS.find((s) => s.key === t.subject)?.short ?? t.subject, topic: t.topic, acc: Math.round((100 * t.correct) / t.total), answered: t.total }));
  const mocks = attempts.filter((a) => ["MOCK", "NATIONAL_MOCK", "MINI_MOCK", "LAB_TEST"].includes(a.type));
  const trend = mocks.length >= 2 ? mocks[0].score - mocks[Math.min(mocks.length - 1, 3)].score : null;
  return {
    name: p.fullName, readiness: p.readiness, bestMock: p.bestMock, tests: attempts.length,
    daysToExam: Math.max(0, Math.ceil((EXAM.getTime() - Date.now()) / 86400000)),
    subjects,
    weakTopics: [...tp].sort((a, b) => a.acc - b.acc).slice(0, 8),
    strongTopics: [...tp].sort((a, b) => b.acc - a.acc).filter((t) => t.acc >= 70).slice(0, 5),
    recent: attempts.slice(0, 15).map((a) => ({ type: a.type, score: a.score, date: a.submittedAt! })),
    trend, integrityFlags: attempts.reduce((n, a) => n + a.flags.length, 0),
  };
}

/** Rule-based plan. Weak subjects are ranked by how many exam marks they can still add. */
export function ruleCoach(d: CoachData): CoachAdviceT {
  if (d.tests === 0) {
    return {
      headline: "Start with Mock 1",
      summary: "We do not know your strengths yet. Mock 1 shows where you stand in every NSCT subject and tells you what to study.",
      focus: [{ title: "Take Mock 1", why: "Your plan is built from your own answers.", action: "Open Mock tests and finish Mock 1 in one sitting." }, { title: "Or warm up first", why: "Short levels build confidence.", action: "Play level 1 of Problem Solving in Preparation." }],
      weekPlan: ["Day 1: Mock 1", "Day 2: read the guidance and the explanation of every wrong answer", "Day 3 to 7: two preparation levels a day in your weakest subjects, and one video lecture"],
      source: "rules",
    };
  }
  const gain = d.subjects
    .map((s) => ({ ...s, gain: s.acc == null ? s.weight * 0.6 : (s.weight * (100 - s.acc)) / 100 }))
    .sort((a, b) => b.gain - a.gain);
  const untouched = d.subjects.filter((s) => s.answered < 5);
  const focus: CoachAdviceT["focus"] = [];
  for (const s of gain.slice(0, 3)) {
    const topic = d.weakTopics.find((t) => s.name.startsWith(t.subject) || SUBJECTS.find((x) => x.key === s.key)?.short === t.subject);
    focus.push({
      title: s.name,
      why: s.acc == null ? `You have not practised it yet and it carries ${s.weight}% of the exam.` : `Your accuracy is ${s.acc}% and it carries ${s.weight}% of the exam, so it can add up to ${Math.round(s.gain)} marks.`,
      action: topic ? `Watch its lecture in Study materials, then replay the "${topic.topic}" level (${topic.acc}% so far) until you get three stars.` : `Watch its lecture in Study materials, then play its levels in Preparation.`,
    });
  }
  const level = d.readiness >= 70 ? "on track" : d.readiness >= 50 ? "close" : "building up";
  const trendTxt = d.trend == null ? "" : d.trend > 2 ? ` Your recent tests are up ${d.trend} points, keep going.` : d.trend < -2 ? ` Your recent tests dropped ${-d.trend} points. Slow down and review mistakes before new tests.` : " Your scores are steady.";
  const mocksDone = d.recent.filter((r) => r.type === "MOCK" || r.type === "NATIONAL_MOCK").length;
  return {
    headline: `Readiness ${d.readiness}/100, you are ${level}`,
    summary: `${d.daysToExam} days to NSCT. Your best mock is ${d.bestMock}%.${trendTxt}${untouched.length ? ` You have barely touched ${untouched.map((s) => s.name).slice(0, 2).join(" and ")}.` : ""}`,
    focus,
    weekPlan: [
      `Daily: two preparation levels in ${focus[0]?.title ?? "your weakest subject"}`,
      `Every second day: one video lecture and one level in ${focus[1]?.title ?? "your second weakest subject"}`,
      "Aim for three stars on every level before moving on",
      mocksDone < 1 ? "This week: Mock 1 under timed conditions" : "Weekend: the next mock, then follow its guidance",
      ...(d.strongTopics.length ? [`Keep ${d.strongTopics[0].topic} fresh with 5 questions twice a week`] : []),
    ],
    source: "rules",
  };
}

/** Advice for the student dashboard, cached for the day. */
export async function getCoach(userId: string, lang = "English"): Promise<CoachAdviceT | null> {
  const day = new Date().toISOString().slice(0, 10);
  const cached = await prisma.coachAdvice.findUnique({ where: { userId } });
  if (cached?.day === day) return cached.content as unknown as CoachAdviceT;
  const d = await coachData(userId);
  if (!d) return null;
  let advice = ruleCoach(d);
  if (process.env.ANTHROPIC_API_KEY && d.tests > 0) {
    try {
      const { coachRewrite } = await import("./ai");
      const { name: _n, ...anon } = d; // the AI never gets the name
      advice = { ...(await coachRewrite(advice, anon, lang)), source: "ai" };
    } catch { /* keep the rule-based plan */ }
  }
  await prisma.coachAdvice.upsert({ where: { userId }, create: { userId, day, content: advice as object }, update: { day, content: advice as object } });
  return advice;
}
