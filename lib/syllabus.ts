// NSCT syllabus weights and test blueprints. Single source of truth.
import type { Subject, AttemptType } from "@prisma/client";

export const SUBJECTS: { key: Subject; name: string; short: string; weight: number }[] = [
  { key: "PS", name: "Problem Solving & Analytical Skills", short: "Problem Solving", weight: 20 },
  { key: "PROG", name: "Programming (C++/Java/Python)", short: "Programming", weight: 10 },
  { key: "DSA", name: "Data Structures & Algorithms", short: "DSA", weight: 10 },
  { key: "DB", name: "Databases", short: "Databases", weight: 10 },
  { key: "SE", name: "Software Engineering", short: "Software Eng.", weight: 10 },
  { key: "WEB", name: "Web Development", short: "Web Dev", weight: 10 },
  { key: "AI", name: "AI/ML & Data Analytics", short: "AI/ML", weight: 10 },
  { key: "NET", name: "Computer Networks & Cloud Computing", short: "Networks & Cloud", weight: 10 },
  { key: "OS", name: "Operating Systems", short: "OS", weight: 5 },
  { key: "SEC", name: "Cyber Security", short: "Cyber Security", weight: 5 },
];

export const WEIGHT: Record<Subject, number> = Object.fromEntries(
  SUBJECTS.map((s) => [s.key, s.weight]),
) as Record<Subject, number>;

export const TEST_DATE = new Date("2027-01-23T09:00:00+05:00");

type Blueprint = Partial<Record<Subject, number>>;

export const BLUEPRINTS: Record<"DIAGNOSTIC" | "MOCK" | "NATIONAL_MOCK", Blueprint> = {
  DIAGNOSTIC: { PS: 4, PROG: 2, DSA: 2, DB: 2, SE: 2, WEB: 2, AI: 2, NET: 2, OS: 1, SEC: 1 },
  MOCK: { PS: 12, PROG: 6, DSA: 6, DB: 6, SE: 6, WEB: 6, AI: 6, NET: 6, OS: 3, SEC: 3 },
  NATIONAL_MOCK: { PS: 12, PROG: 6, DSA: 6, DB: 6, SE: 6, WEB: 6, AI: 6, NET: 6, OS: 3, SEC: 3 },
};

export const DURATION_SEC: Partial<Record<AttemptType, number>> = {
  DIAGNOSTIC: 25 * 60,
  MOCK: 60 * 60,
  NATIONAL_MOCK: 60 * 60,
  MINI_MOCK: 15 * 60,
};

/** Minimum group size for any figure shown in an anonymised report. */
export const MIN_GROUP = 20;
