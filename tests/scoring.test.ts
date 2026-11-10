import { describe, it, expect } from "vitest";
import { readiness, band, nextStreak, studyPlan, priorities } from "../lib/scoring";

describe("readiness", () => {
  it("is 0 with no data", () => expect(readiness({})).toEqual({ score: 0, tested: 0 }));
  it("weights subjects by the syllabus", () => {
    // Perfect in Problem Solving (20%) only
    expect(readiness({ PS: { correct: 10, total: 10 } }).score).toBe(20);
    // Perfect everywhere
    const all = Object.fromEntries(["PS", "PROG", "DSA", "DB", "SE", "WEB", "AI", "NET", "OS", "SEC"].map((k) => [k, { correct: 5, total: 5 }]));
    expect(readiness(all)).toEqual({ score: 100, tested: 10 });
  });
});

describe("band", () => {
  it("maps scores to bands", () => {
    expect(band(80).level).toBe("top");
    expect(band(60).level).toBe("qualify");
    expect(band(50).level).toBe("borderline");
    expect(band(10).level).toBe("risk");
  });
});

describe("streak", () => {
  const today = new Date("2026-11-09T10:00:00+05:00");
  it("continues from yesterday", () => expect(nextStreak("2026-11-08", 3, today)).toEqual({ lastDay: "2026-11-09", days: 4 }));
  it("does not double count today", () => expect(nextStreak("2026-11-09", 3, today).days).toBe(3));
  it("resets after a gap", () => expect(nextStreak("2026-11-01", 9, today).days).toBe(1));
});

describe("plan", () => {
  it("ends with test week and starts with diagnostic when none taken", () => {
    const p = studyPlan({}, false, new Date("2026-11-09T10:00:00+05:00"));
    expect(p[0].title).toBe("Find your level");
    expect(p[p.length - 1].title).toBe("Test week");
  });
  it("puts weak high-weight subjects first", () => {
    const pr = priorities({ PS: { correct: 1, total: 10 }, OS: { correct: 1, total: 10 } });
    expect(pr[0].key).toBe("PS");
  });
});
