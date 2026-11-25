// Detailed mock test results: per section right, wrong and skipped, used by the web view, PDF and Excel.
import { prisma } from "./db";
import { HttpError } from "./errors";
import { profileScope, type SessionUser } from "./auth";
import { SUBJECTS } from "./syllabus";

export const MOCK_TYPES = ["MOCK", "NATIONAL_MOCK", "DIAGNOSTIC"] as const;

export type Section = { key: string; name: string; weight: number; total: number; correct: number; wrong: number; skipped: number; pct: number };
export type MockDetail = {
  attemptId: string; label: string; type: string; submittedAt: string | null; minutes: number; score: number;
  total: number; correct: number; wrong: number; skipped: number; autoSubmitted: string | null;
  student: { userId: string; fullName: string; rollNumber: string; program: string; semester: string; section: string | null; university: string; department: string | null };
  sections: Section[];
  weakTopics: { topic: string; subject: string; wrong: number; total: number }[];
  questions: { n: number; subject: string; topic: string; status: "correct" | "wrong" | "skipped"; timeSec: number }[];
};

/** Who may see a given student's results: the student, staff whose scope includes the student, or the super admin. */
async function assertCanSee(u: SessionUser, userId: string) {
  if (u.id === userId) return;
  if (u.role === "STUDENT") throw new HttpError(403, "You can only see your own results.");
  if (u.role === "ADMIN") return;
  const ok = await prisma.profile.findFirst({ where: { userId, ...profileScope(u) }, select: { userId: true } });
  if (!ok) throw new HttpError(403, "This student is not in your university or department.");
}

export async function mockDetail(u: SessionUser, attemptId: string): Promise<MockDetail> {
  const a = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, type: true, label: true, score: true, startedAt: true, submittedAt: true, flags: true,
      items: { orderBy: { position: "asc" }, select: { position: true, chosen: true, correct: true, timeSec: true, question: { select: { subject: true, topic: true } } } } },
  });
  if (!a) throw new HttpError(404, "Result not found.");
  await assertCanSee(u, a.userId);
  if (!a.submittedAt) throw new HttpError(400, "This test has not been submitted yet.");
  const p = await prisma.profile.findUnique({ where: { userId: a.userId }, select: { userId: true, fullName: true, rollNumber: true, program: true, semester: true, section: true, university: { select: { name: true } }, department: { select: { name: true } } } });

  const by = new Map<string, Section>();
  const topics = new Map<string, { topic: string; subject: string; wrong: number; total: number }>();
  const questions: MockDetail["questions"] = [];
  for (const it of a.items) {
    const s = SUBJECTS.find((x) => x.key === it.question.subject);
    const sec = by.get(it.question.subject) ?? { key: it.question.subject, name: s?.name ?? it.question.subject, weight: s?.weight ?? 0, total: 0, correct: 0, wrong: 0, skipped: 0, pct: 0 };
    const status: "correct" | "wrong" | "skipped" = !it.chosen?.length && it.correct !== true ? "skipped" : it.correct ? "correct" : "wrong";
    sec.total++; sec[status === "correct" ? "correct" : status === "wrong" ? "wrong" : "skipped"]++;
    by.set(it.question.subject, sec);
    const tk = `${it.question.subject}|${it.question.topic}`;
    const t = topics.get(tk) ?? { topic: it.question.topic, subject: s?.short ?? it.question.subject, wrong: 0, total: 0 };
    t.total++; if (status !== "correct") t.wrong++;
    topics.set(tk, t);
    questions.push({ n: it.position + 1, subject: s?.short ?? it.question.subject, topic: it.question.topic, status, timeSec: it.timeSec });
  }
  const sections = SUBJECTS.map((s) => by.get(s.key)).filter(Boolean).map((x) => ({ ...x!, pct: x!.total ? Math.round((100 * x!.correct) / x!.total) : 0 }));
  const correct = sections.reduce((t, s) => t + s.correct, 0), wrong = sections.reduce((t, s) => t + s.wrong, 0), skipped = sections.reduce((t, s) => t + s.skipped, 0);
  const auto = a.flags?.find((f) => f.startsWith("AUTO_SUBMITTED_"));
  return {
    attemptId: a.id, label: a.label ?? (a.type === "NATIONAL_MOCK" ? "National mock" : a.type === "DIAGNOSTIC" ? "Diagnostic test" : "Mock test"), type: a.type,
    submittedAt: a.submittedAt.toISOString(), minutes: Math.max(1, Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 60000)),
    score: Math.round(a.score), total: a.items.length, correct, wrong, skipped,
    autoSubmitted: auto ? auto.replace("AUTO_SUBMITTED_", "").replace(/_/g, " ").toLowerCase() : null,
    student: { userId: a.userId, fullName: p?.fullName ?? "Student", rollNumber: p?.rollNumber ?? "", program: p?.program ?? "", semester: p?.semester ?? "", section: p?.section ?? null, university: p?.university?.name ?? "", department: p?.department?.name ?? null },
    sections, weakTopics: [...topics.values()].filter((t) => t.wrong > 0).sort((x, y) => y.wrong - x.wrong || x.topic.localeCompare(y.topic)).slice(0, 12), questions,
  };
}

/** Mock results list: the student's own, or every student in the staff member's scope. */
export async function mockList(u: SessionUser, opts: { label?: string; q?: string; take?: number }) {
  const scopeIds = u.role === "STUDENT" ? [u.id] : null;
  const profileWhere = u.role === "STUDENT" ? { userId: u.id } : u.role === "ADMIN" ? {} : profileScope(u);
  const q = (opts.q ?? "").trim();
  const attempts = await prisma.attempt.findMany({
    where: {
      type: { in: [...MOCK_TYPES] }, submittedAt: { not: null },
      ...(opts.label ? { label: opts.label } : {}),
      ...(scopeIds ? { userId: { in: scopeIds } } : { user: { profile: { is: { ...profileWhere, ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { rollNumber: { contains: q, mode: "insensitive" } }] } : {}) } } } }),
    },
    orderBy: { submittedAt: "desc" }, take: Math.min(opts.take ?? 500, 3000),
    select: { id: true, userId: true, type: true, label: true, score: true, startedAt: true, submittedAt: true, flags: true,
      user: { select: { profile: { select: { fullName: true, rollNumber: true, program: true, semester: true, section: true, department: { select: { name: true } } } } } },
      items: { select: { correct: true, chosen: true, question: { select: { subject: true } } } } },
  });
  return attempts.map((a) => {
    const sec: Record<string, { c: number; w: number; s: number; t: number }> = {};
    for (const it of a.items) {
      const k = it.question.subject; sec[k] = sec[k] ?? { c: 0, w: 0, s: 0, t: 0 }; sec[k].t++;
      if (it.correct) sec[k].c++; else if (!it.chosen?.length) sec[k].s++; else sec[k].w++;
    }
    const tot = Object.values(sec).reduce((x, y) => ({ c: x.c + y.c, w: x.w + y.w, s: x.s + y.s, t: x.t + y.t }), { c: 0, w: 0, s: 0, t: 0 });
    const p = a.user.profile;
    return {
      attemptId: a.id, userId: a.userId, label: a.label ?? "Mock test", score: Math.round(a.score), submittedAt: a.submittedAt,
      minutes: a.submittedAt ? Math.max(1, Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 60000)) : 0,
      autoSubmitted: !!a.flags?.some((f) => f.startsWith("AUTO_SUBMITTED_")),
      fullName: p?.fullName ?? "", rollNumber: p?.rollNumber ?? "", program: p?.program ?? "", semester: p?.semester ?? "", section: p?.section ?? null, department: p?.department?.name ?? null,
      correct: tot.c, wrong: tot.w, skipped: tot.s, total: tot.t, sections: sec,
    };
  });
}
