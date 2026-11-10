import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { band, readiness, studyPlan, priorities } from "@/lib/scoring";
import { TEST_DATE } from "@/lib/syllabus";

export const GET = handle(async () => {
  const u = await requireUser();
  const [profile, mastery, attempts, mistakes, topics] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: u.id }, include: { university: true } }),
    prisma.mastery.findMany({ where: { userId: u.id } }),
    prisma.attempt.findMany({ where: { userId: u.id, submittedAt: { not: null } }, orderBy: { submittedAt: "desc" }, take: 20 }),
    prisma.mistake.count({ where: { userId: u.id } }),
    prisma.topicMastery.findMany({ where: { userId: u.id, total: { gte: 3 } } }),
  ]);
  const notices = await prisma.notice.findMany({
    where: { OR: [{ universityId: null }, { universityId: profile?.universityId ?? "-" }] },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const m = Object.fromEntries(mastery.map((x) => [x.subject, x]));
  const rd = readiness(m);
  const mocks = attempts.filter((a) => a.type === "MOCK" || a.type === "NATIONAL_MOCK").length;
  const hasDiagnostic = attempts.some((a) => a.type === "DIAGNOSTIC");
  return {
    profile,
    readiness: rd,
    band: band(rd.score),
    mastery,
    weakTopics: topics.map((t) => ({ ...t, acc: t.correct / t.total })).sort((a, b) => a.acc - b.acc).slice(0, 5),
    priorities: priorities(m),
    attempts,
    mistakes,
    notices,
    daysLeft: Math.max(0, Math.ceil((TEST_DATE.getTime() - Date.now()) / 86400000)),
    plan: studyPlan(m, hasDiagnostic),
    badges: [
      { key: "diagnostic", label: "Diagnostic done", on: hasDiagnostic },
      { key: "mock1", label: "First mock", on: mocks >= 1 },
      { key: "mock3", label: "3 mocks", on: mocks >= 3 },
      { key: "streak7", label: "7-day streak", on: (profile?.streakDays ?? 0) >= 7 },
      { key: "star", label: "Subject star", on: mastery.some((x) => x.total >= 10 && x.correct / x.total >= 0.8) },
      { key: "p500", label: "500 points", on: (profile?.points ?? 0) >= 500 },
    ],
  };
});
