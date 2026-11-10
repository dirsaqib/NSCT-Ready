// AI tutor on the Anthropic API, with a daily per-student limit to control cost.
import Anthropic from "@anthropic-ai/sdk";
import type { Subject } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { HttpError } from "./errors";
import { pkDay } from "./scoring";
import { SUBJECTS } from "./syllabus";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const FAST = process.env.ANTHROPIC_MODEL_FAST || "claude-haiku-5-5";
const SMART = process.env.ANTHROPIC_MODEL_SMART || "claude-sonnet-5-5";
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 40);

export type Lang = "English" | "Urdu" | "Roman Urdu";
const langLine = (l: Lang) =>
  l === "Urdu"
    ? "Answer in Urdu script. Keep technical terms in English."
    : l === "Roman Urdu"
      ? "Answer in Roman Urdu. Keep technical terms in English."
      : "Answer in simple English.";

export async function useQuota(userId: string, cost = 1, limit = DAILY_LIMIT) {
  const day = pkDay();
  const row = await prisma.aiUsage.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, calls: cost },
    update: { calls: { increment: cost } },
  });
  if (row.calls > limit) throw new HttpError(429, limit < DAILY_LIMIT ? "You have used today's free AI tutor calls. Get Pro access for more." : "You have used today's AI tutor limit. It resets at midnight.", limit < DAILY_LIMIT ? "PRO_REQUIRED" : undefined);
}

async function text(model: string, system: string, messages: Anthropic.MessageParam[], maxTokens = 700) {
  const r = await client.messages.create({ model, max_tokens: maxTokens, system, messages });
  return r.content.map((c) => (c.type === "text" ? c.text : "")).join("");
}

const subjectName = (s: Subject) => SUBJECTS.find((x) => x.key === s)?.name ?? s;

export async function explainMistake(q: { subject: Subject; topic: string; text: string; code: string | null; options: string[]; answers: number[]; type: string }, chosen: number[], lang: Lang) {
  const L = "ABCDEF";
  const prompt = `Subject: ${subjectName(q.subject)}. Topic: ${q.topic}
Question: ${q.text}
${q.code ? `Code:\n${q.code}\n` : ""}Options:
${q.options.map((o, i) => `${L[i]}) ${o}`).join("\n")}
Correct answer: ${q.answers.map((i) => L[i]).join(", ")}${q.type === "MULTI" ? " (select all that apply)" : ""}
Student chose: ${chosen.length ? chosen.map((i) => L[i]).join(", ") : "no answer"}`;
  return text(
    FAST,
    `You are a friendly tutor for Pakistani computing students preparing for the NSCT. ${langLine(lang)} In under 150 words explain why the correct answer is right and the student's choice is wrong, then give one tip. No headings.`,
    [{ role: "user", content: prompt }],
    500,
  );
}

export async function tutorChat(history: { role: "user" | "assistant"; content: string }[], weak: string[], lang: Lang) {
  return text(
    FAST,
    `You are a patient tutor for Pakistani computing students preparing for the NSCT on 23 and 24 January 2027. Syllabus: Problem Solving 20%, Programming, DSA, Databases, Software Engineering, Web Development, AI/ML, Networks and Cloud 10% each, OS and Cyber Security 5% each. ${langLine(lang)} Keep answers short with small examples. Student's weakest subjects: ${weak.join(", ") || "not measured yet"}. Stay on NSCT and computing topics.`,
    history.slice(-12),
    900,
  );
}

const GenQ = z.object({
  q: z.string().min(5),
  code: z.string().optional().default(""),
  options: z.array(z.string()).length(4),
  answer: z.number().int().min(0).max(3),
  explanation: z.string().min(3),
  topic: z.string().optional(),
  difficulty: z.number().int().min(1).max(3).optional(),
});

export async function generateQuestions(subject: Subject, topic: string | undefined, count: number) {
  const raw = await text(
    SMART,
    "You write exam questions. Reply with JSON only, no prose and no code fences.",
    [
      {
        role: "user",
        content: `Write ${count} new multiple-choice questions for Pakistan's NSCT for computing graduates.
Subject: ${subjectName(subject)}${topic ? `. Topic: ${topic}` : ""}.
Each has exactly 4 options and one correct answer. Test applied understanding. Code under 12 lines in "code". Explanations 1 to 3 sentences.
Return {"questions":[{"q":"","code":"","options":["","","",""],"answer":0,"explanation":"","topic":"","difficulty":2}]}`,
      },
    ],
    3000,
  );
  const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  const arr: unknown[] = Array.isArray(json?.questions) ? json.questions : [];
  return arr.flatMap((x) => {
    const p = GenQ.safeParse(x);
    return p.success ? [{ ...p.data, topic: (p.data.topic || topic || "General").slice(0, 60) }] : [];
  });
}
