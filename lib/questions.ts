// Question bank rules shared by the API: validation, duplicate detection and version history.
import { z } from "zod";
import { prisma } from "./db";
import { contentHash } from "./crypto";
import { HttpError } from "./errors";

export const SubjectEnum = z.enum(["PS", "PROG", "DSA", "DB", "SE", "WEB", "AI", "NET", "OS", "SEC"]);
export const SKILL_LEVELS = ["Remember", "Understand", "Apply", "Analyse", "Evaluate", "Create"] as const;

export const QuestionInput = z
  .object({
    type: z.enum(["SINGLE", "MULTI", "SCENARIO", "CODE"]).default("SINGLE"),
    subject: SubjectEnum,
    topic: z.string().trim().min(2).max(60),
    difficulty: z.number().int().min(1).max(3).default(2),
    skillLevel: z.enum(SKILL_LEVELS).optional(),
    text: z.string().trim().min(5).max(3000),
    code: z.string().max(4000).nullable().optional(),
    options: z.array(z.string().trim().min(1).max(500)).max(6).default([]),
    answers: z.array(z.number().int().min(0).max(5)).default([]),
    explanation: z.string().trim().min(3).max(3000),
    scenarioId: z.string().optional(),
    scenario: z.object({ title: z.string().min(2).max(120), passage: z.string().min(20).max(6000) }).optional(),
    language: z.enum(["python", "cpp", "java", "javascript"]).optional(),
    starterCode: z.string().max(4000).optional(),
    tests: z.array(z.object({ input: z.string().max(2000), expected: z.string().max(2000), hidden: z.boolean().default(false) })).max(20).optional(),
    source: z.enum(["FACULTY", "AI_REVIEWED", "IMPORT"]).default("FACULTY"),
    secure: z.boolean().default(false),
    replacesId: z.string().optional(),
    bank: z.enum(["NATIONAL", "DEPARTMENT"]).default("NATIONAL"),
    departmentId: z.string().optional(),
  })
  .superRefine((q, ctx) => {
    if (q.type === "CODE") {
      if (!q.language) ctx.addIssue({ code: "custom", message: "Choose a programming language." });
      if (!q.tests?.length) ctx.addIssue({ code: "custom", message: "Add at least one test case." });
      return;
    }
    if (q.options.length < 2) ctx.addIssue({ code: "custom", message: "Add at least two options." });
    if (q.answers.some((a) => a >= q.options.length)) ctx.addIssue({ code: "custom", message: "The correct answer must be one of the options." });
    if (q.type === "MULTI" ? q.answers.length < 2 : q.answers.length !== 1) ctx.addIssue({ code: "custom", message: q.type === "MULTI" ? "Mark at least two correct options." : "Mark exactly one correct option." });
    if (q.type === "SCENARIO" && !q.scenarioId && !q.scenario) ctx.addIssue({ code: "custom", message: "Add the scenario text." });
  });

export type QuestionData = z.infer<typeof QuestionInput>;

/** Exact duplicates are refused. The caller gets the id of the existing question. */
export async function assertNotDuplicate(q: { text: string; options: string[] }, ignoreId?: string) {
  const hash = contentHash(q.text, q.options);
  const dup = await prisma.question.findFirst({ where: { contentHash: hash, ...(ignoreId ? { id: { not: ignoreId } } : {}), status: { not: "RETIRED" } }, select: { id: true } });
  if (dup) throw new HttpError(409, `This question already exists in the bank (${dup.id}).`, "DUPLICATE");
  return hash;
}

/** Near duplicates: shares most of its words with an existing question in the same subject. */
export async function similarQuestions(subject: string, text: string, ignoreId?: string) {
  const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 3));
  const mine = words(text);
  if (mine.size < 4) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = await prisma.question.findMany({ where: { subject: subject as any, status: { not: "RETIRED" }, ...(ignoreId ? { id: { not: ignoreId } } : {}) }, select: { id: true, text: true }, take: 3000 });
  return pool
    .map((q) => { const w = words(q.text); let inter = 0; mine.forEach((x) => w.has(x) && inter++); return { id: q.id, text: q.text, score: inter / Math.max(mine.size, w.size) }; })
    .filter((x) => x.score >= 0.7)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export async function saveVersion(questionId: string, editorId: string) {
  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) return;
  const { id: _id, createdAt: _c, updatedAt: _u, ...snap } = q;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.questionVersion.create({ data: { questionId, version: q.version, snapshot: snap as any, editedById: editorId } });
}

/**
 * DEPARTMENT questions go live at once in the owner department's own bank and are used only in its lab tests.
 * NATIONAL questions wait for review unless the super admin adds them.
 */
export async function createQuestion(d: QuestionData, authorId: string, authorUniversityId: string | null, live: boolean, ownerDepartmentId: string | null = null) {
  const dept = d.bank === "DEPARTMENT";
  const contentHashValue = await assertNotDuplicate({ text: d.text, options: d.options });
  let scenarioId = d.scenarioId;
  if (!scenarioId && d.scenario) scenarioId = (await prisma.scenario.create({ data: d.scenario })).id;
  return prisma.question.create({
    data: {
      type: d.type, subject: d.subject, topic: d.topic, difficulty: d.difficulty, skillLevel: d.skillLevel, text: d.text, code: d.code || null,
      options: d.type === "CODE" ? [] : d.options, answers: d.type === "CODE" ? [] : d.answers, explanation: d.explanation, scenarioId,
      language: d.language, starterCode: d.starterCode, tests: d.tests, source: d.source, replacesId: d.replacesId,
      contentHash: contentHashValue, authorId, authorUniversityId, status: live || dept ? "LIVE" : "SUBMITTED",
      scope: dept ? "DEPARTMENT" : "NATIONAL", ownerDepartmentId: dept ? ownerDepartmentId : null, secure: dept ? false : d.secure,
    },
  });
}

/** The department a staff member's department-bank questions belong to. Focal persons and admins must name one. */
export async function ownerDepartmentFor(u: { role: string; universityId: string | null; departmentId: string | null }, requested?: string | null) {
  if (u.departmentId && u.role !== "ADMIN" && u.role !== "FOCAL" && u.role !== "CHAIR" && u.role !== "CAMPUS_ADMIN") return u.departmentId;
  const id = requested || u.departmentId;
  if (!id) throw new HttpError(400, "Choose the department this question bank belongs to.");
  const d = await prisma.department.findUnique({ where: { id }, include: { campus: true } });
  if (!d || (u.role !== "ADMIN" && d.campus.universityId !== u.universityId)) throw new HttpError(403, "That department is not in your university.");
  return d.id;
}
