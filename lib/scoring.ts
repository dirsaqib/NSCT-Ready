// Readiness, bands and study plan. Pure functions so they can be unit tested.
import type { Subject } from "@prisma/client";
import { SUBJECTS, TEST_DATE } from "./syllabus";

export type MasteryMap = Partial<Record<Subject, { correct: number; total: number }>>; // correct may be fractional (partial credit)

/** Weighted readiness 0 to 100. Untested subjects count as 0. */
export function readiness(m: MasteryMap): { score: number; tested: number } {
  let score = 0;
  let tested = 0;
  for (const s of SUBJECTS) {
    const x = m[s.key];
    if (x && x.total > 0) {
      tested++;
      score += s.weight * (x.correct / x.total);
    }
  }
  return { score: Math.round(score), tested };
}

/** Platform estimate only. The official NSCT cut-off is not published. */
export function band(score: number): { label: string; level: "top" | "qualify" | "borderline" | "risk" } {
  if (score >= 75) return { label: "Top performer range", level: "top" };
  if (score >= 60) return { label: "Likely to qualify", level: "qualify" };
  if (score >= 45) return { label: "Borderline", level: "borderline" };
  return { label: "At risk", level: "risk" };
}

/** Subject priority = exam weight x room to improve. Untested subjects assume 40% accuracy. */
export function priorities(m: MasteryMap) {
  return SUBJECTS.map((s) => {
    const x = m[s.key];
    const acc = x && x.total ? x.correct / x.total : null;
    return { ...s, acc, priority: s.weight * (1 - (acc ?? 0.4)) };
  }).sort((a, b) => b.priority - a.priority);
}

export type PlanWeek = { from: Date; to: Date; title: string; tasks: string[] };

export function studyPlan(m: MasteryMap, hasDiagnostic: boolean, today = new Date()): PlanWeek[] {
  const pri = priorities(m);
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday
  const weeks: { from: Date; to: Date }[] = [];
  for (const d = new Date(start); d < TEST_DATE; d.setDate(d.getDate() + 7)) {
    const to = new Date(d);
    to.setDate(to.getDate() + 6);
    weeks.push({ from: new Date(d), to });
  }
  let k = 0;
  return weeks.map((w, i) => {
    const last = i === weeks.length - 1;
    const second = i === weeks.length - 2;
    if (i === 0 && !hasDiagnostic)
      return { ...w, title: "Find your level", tasks: ["Take the diagnostic test", "Practise your two weakest subjects", "15 minutes of Problem Solving drills daily"] };
    if (last)
      return { ...w, title: "Test week", tasks: ["Light revision from your Mistakes notebook", "Read your AI revision notes", "Check your test centre and bring your CNIC"] };
    if (second)
      return { ...w, title: "Final full mocks", tasks: ["Two full mock tests under real timing", "Review every wrong answer the same day", "Clear the Mistakes notebook"] };
    const a = pri[(k * 2) % pri.length];
    const b = pri[(k * 2 + 1) % pri.length];
    k++;
    return {
      ...w,
      title: `Focus: ${a.short} and ${b.short}`,
      tasks: [
        `3 practice sets in ${a.name}`,
        `2 practice sets in ${b.name}`,
        "15 minutes of Problem Solving drills daily",
        "1 full mock test at the weekend",
        "Clear this week's mistakes",
      ],
    };
  });
}

/** Day string in Pakistan time, used for streaks and AI quotas. */
export function pkDay(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(d);
}

export function nextStreak(lastDay: string | null, days: number, today = new Date()) {
  const t = pkDay(today);
  const y = pkDay(new Date(today.getTime() - 86400000));
  if (lastDay === t) return { lastDay: t, days };
  return { lastDay: t, days: lastDay === y ? days + 1 : 1 };
}

export function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
