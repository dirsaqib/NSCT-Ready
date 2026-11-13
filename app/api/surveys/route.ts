export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, requireUser, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";

const STAFF = ["FACULTY", "HOD", "CAMPUS_ADMIN", "FOCAL", "CHAIR"];

/** Active surveys for me (not yet answered). Admins get all surveys with result summaries. */
export const GET = handle(async () => {
  const u = await requireUser({ allowWithout2fa: true });
  if (u.role === "ADMIN") {
    const surveys = await prisma.survey.findMany({ orderBy: { createdAt: "desc" }, include: { responses: { select: { answers: true } } } });
    return {
      surveys: surveys.map((s) => {
        const qs = s.questions as { q: string; type: "scale" | "text" }[];
        const res = s.responses.map((r) => r.answers as (number | string)[]);
        return { ...s, responses: undefined, count: res.length, summary: qs.map((q, i) => (q.type === "scale" ? { q: q.q, avg: res.length ? +(res.reduce((a, r) => a + Number(r[i] || 0), 0) / res.length).toFixed(2) : null } : { q: q.q, samples: res.map((r) => String(r[i] ?? "")).filter(Boolean).slice(0, 20) })) };
      }),
    };
  }
  const audience = STAFF.includes(u.role) ? "UNIVERSITY" : "STUDENT";
  const surveys = await prisma.survey.findMany({ where: { active: true, audience: { in: [audience, "ALL"] }, responses: { none: { userId: u.id } } } });
  return { surveys };
});

export const POST = handle(async (req: Request) => {
  const u = await requireUser({ allowWithout2fa: true });
  const b = z.union([
    z.object({ kind: z.literal("answer"), surveyId: z.string(), answers: z.array(z.union([z.number().min(1).max(5), z.string().max(2000)])).max(30) }),
    z.object({ kind: z.literal("create"), title: z.string().min(3).max(150), audience: z.enum(["STUDENT", "UNIVERSITY", "ALL"]), questions: z.array(z.object({ q: z.string().min(3).max(300), type: z.enum(["scale", "text"]) })).min(1).max(30) }),
    z.object({ kind: z.literal("toggle"), surveyId: z.string() }),
  ]).parse(await req.json());
  if (b.kind === "answer") {
    const s = await prisma.survey.findUnique({ where: { id: b.surveyId } });
    if (!s?.active) throw new HttpError(404, "Survey not found.");
    await prisma.surveyResponse.create({ data: { surveyId: s.id, userId: u.id, answers: b.answers } });
    return { ok: true };
  }
  await requireRole("ADMIN");
  if (b.kind === "create") return { survey: await prisma.survey.create({ data: { title: b.title, audience: b.audience, questions: b.questions } }) };
  const s = await prisma.survey.findUnique({ where: { id: b.surveyId } });
  await prisma.survey.update({ where: { id: b.surveyId }, data: { active: !s?.active } });
  return { ok: true };
});
