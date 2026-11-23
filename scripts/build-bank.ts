// Grows the national question bank toward a target size, topic by topic, following the NSCT weightage.
// Every question is written by one model and answered blind by a second. If both agree it goes live,
// otherwise it waits in the review queue. Safe to stop and run again: it counts what already exists.
//
// Usage (from the project folder, with DATABASE_URL and ANTHROPIC_API_KEY set):
//   npx tsx scripts/build-bank.ts                 total 80000, at most 500 new questions this run
//   npx tsx scripts/build-bank.ts --limit 5000    allow 5000 new questions this run
//   npx tsx scripts/build-bank.ts --subject DB    one subject only
//   npx tsx scripts/build-bank.ts --total 20000   a smaller overall target
import Anthropic from "@anthropic-ai/sdk";
import type { Subject } from "@prisma/client";
import { prisma } from "../lib/db";
import { verifyAnswer } from "../lib/ai";
import { createQuestion, QuestionInput } from "../lib/questions";
import { SUBJECTS } from "../lib/syllabus";
import { HttpError } from "../lib/errors";

const arg = (name: string, def: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; };
const TOTAL = Number(arg("total", "80000"));
const LIMIT = Number(arg("limit", "500"));
const ONLY = arg("subject", "") as Subject | "";
const CONCURRENCY = Number(arg("parallel", "4"));
const MODEL = process.env.ANTHROPIC_MODEL_SMART || "claude-sonnet-5-5";

// Topic map built from the NSCT areas of competencies. Problem Solving uses its 16 official sub-areas.
const TOPICS: Record<Subject, string[]> = {
  PS: ["Introduction to problem solving", "Problem understanding and analysis", "Logical reasoning fundamentals", "Algorithms and flow control", "Data representation and abstraction", "Pattern recognition and generalization", "Mathematical and quantitative reasoning", "Algorithmic thinking", "Critical thinking and decision making", "Debugging and error analysis", "Complexity and efficiency awareness", "Problem solving using programming", "Data-driven problem solving", "Creative and innovative thinking", "Real-world problem solving", "Communication and documentation of solutions"],
  PROG: ["Variables, types and operators", "Control flow and loops", "Functions and recursion", "Arrays, strings and collections", "Pointers and memory (C/C++)", "Object-oriented programming", "Inheritance and polymorphism", "Exception handling", "File handling", "Python specifics", "Java specifics", "C++ specifics", "Code tracing and output prediction", "Generics and templates", "Concurrency basics"],
  DSA: ["Complexity analysis", "Arrays and searching", "Sorting algorithms", "Linked lists", "Stacks and queues", "Trees and BSTs", "Balanced trees and heaps", "Hashing", "Graphs and traversal", "Shortest paths and MST", "Recursion and backtracking", "Divide and conquer", "Greedy algorithms", "Dynamic programming"],
  DB: ["Relational model and keys", "ER modelling", "SQL queries", "Joins and subqueries", "Aggregation and grouping", "Normalization", "Transactions and ACID", "Concurrency control", "Indexing and query performance", "Views, procedures and triggers", "NoSQL databases", "Data warehousing", "Database security"],
  SE: ["SDLC and process models", "Agile and Scrum", "Requirements engineering", "Software design principles", "Design patterns", "UML modelling", "Software testing", "Test design techniques", "Version control and Git", "CI/CD and DevOps", "Project management and estimation", "Software quality and maintenance", "Risk management", "Professional ethics"],
  WEB: ["HTML structure and forms", "CSS layout and styling", "Responsive design", "JavaScript fundamentals", "DOM and events", "Async JavaScript and fetch", "HTTP and status codes", "REST APIs and JSON", "Front-end frameworks", "Server-side development", "Web security", "Web performance and SEO", "Accessibility"],
  AI: ["AI foundations and search", "Machine learning basics", "Supervised learning", "Unsupervised learning", "Model evaluation metrics", "Overfitting and regularization", "Neural networks", "Deep learning and CNNs", "NLP and transformers", "Generative AI and LLMs", "Data preprocessing", "Data analytics and visualization", "Statistics for data science", "AI ethics"],
  NET: ["OSI and TCP/IP models", "Physical and data link layer", "IP addressing and subnetting", "Routing", "Transport layer TCP/UDP", "Application layer protocols", "DNS and DHCP", "Network devices and topologies", "Wireless networks", "Network security basics", "Cloud service models", "Virtualization and containers", "Cloud scaling and reliability"],
  OS: ["OS structure and kernel", "Processes and threads", "CPU scheduling", "Synchronization", "Deadlocks", "Memory management", "Virtual memory and paging", "File systems", "I/O and disk scheduling", "Linux commands"],
  SEC: ["Security fundamentals (CIA)", "Cryptography", "Authentication and access control", "Malware", "Network security", "Web application security", "Social engineering", "Security operations and incident response", "Cyber laws and ethics"],
};

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const L = "ABCD";

async function generate(subject: Subject, topic: string, difficulty: number, avoid: string[]) {
  const name = SUBJECTS.find((s) => s.key === subject)!.name;
  const r = await client.messages.create({
    model: MODEL,
    max_tokens: 3500,
    system: "You write original exam questions. Reply with JSON only, no prose and no code fences.",
    messages: [{ role: "user", content: `Write 10 NEW original multiple-choice questions for Pakistan's National Skills Competency Test (NSCT) for final-year computing students.
Subject: ${name}. Topic: ${topic}. Difficulty: ${difficulty} of 3 (1 = recall, 2 = applied, 3 = multi-step reasoning).
Rules: exactly 4 options, exactly one correct. Test applied understanding, prefer short realistic scenarios and code. Code under 12 lines goes in "code". Explanations 1 to 3 sentences. Do not copy questions from books, past papers or websites. Vary the question style.
Do not repeat or rephrase these existing questions:
${avoid.slice(0, 40).map((q) => `- ${q}`).join("\n") || "- none yet"}
Return {"questions":[{"q":"","code":"","options":["","","",""],"answer":0,"explanation":""}]}` }],
  });
  const raw = r.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  return (Array.isArray(json?.questions) ? json.questions : []) as { q: string; code?: string; options: string[]; answer: number; explanation: string }[];
}

let made = 0, live = 0, review = 0, dup = 0, bad = 0;

const rounds = new Map<string, number>();

/** Adds one batch of up to 10 questions to a topic. Returns false once the topic has reached its target. */
async function oneBatch(subject: Subject, topic: string, target: number, authorId: string): Promise<boolean> {
  {
    const have = await prisma.question.count({ where: { subject, topic, scope: "NATIONAL", status: { in: ["LIVE", "SUBMITTED"] } } });
    if (have >= target) return false;
    const round = rounds.get(topic) ?? 0; rounds.set(topic, round + 1);
    const avoid = (await prisma.question.findMany({ where: { subject, topic }, select: { text: true }, orderBy: { createdAt: "desc" }, take: 40 })).map((x) => x.text);
    const difficulty = (round % 3) + 1;
    let drafts: Awaited<ReturnType<typeof generate>> = [];
    try { drafts = await generate(subject, topic, difficulty, avoid); } catch (e) { console.warn(`  ${subject}/${topic}: generation failed, will retry`, (e as Error).message); await new Promise((r) => setTimeout(r, 5000)); return true; }
    if (!drafts.length) { bad++; return true; }
    for (const g of drafts) {
      if (made >= LIMIT) return false;
      // Put the correct option in a random position.
      const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
      const options = order.map((i) => String(g.options?.[i] ?? ""));
      const answer = order.indexOf(g.answer);
      const parsed = QuestionInput.safeParse({ type: "SINGLE", subject, topic, difficulty, text: g.q, code: g.code || null, options, answers: [answer], explanation: g.explanation, source: "AI_REVIEWED" });
      if (!parsed.success) { bad++; continue; }
      const ok = await verifyAnswer({ text: g.q, code: g.code, options }, answer);
      try {
        await createQuestion(parsed.data, authorId, null, ok);
        made++; if (ok) live++; else review++;
      } catch (e) {
        if (e instanceof HttpError && e.status === 409) dup++; else bad++;
      }
    }
    console.log(`  ${subject} / ${topic}: about ${Math.min(have + drafts.length, target)} of ${target}   (this run: ${made} new, ${live} live, ${review} for review, ${dup} duplicates)`);
    return true;
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY first.");
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("No super admin account found.");
  const jobs: [Subject, string, number][] = [];
  for (const s of SUBJECTS) {
    if (ONLY && s.key !== ONLY) continue;
    const topics = TOPICS[s.key];
    const perTopic = Math.ceil((TOTAL * s.weight) / 100 / topics.length);
    for (const t of topics) jobs.push([s.key, t, perTopic]);
  }
  console.log(`Target ${TOTAL} questions across ${jobs.length} topics. This run adds at most ${LIMIT}.`);
  // Round robin: one batch per topic per pass, so even a short run covers every topic evenly.
  let open = jobs;
  while (open.length && made < LIMIT) {
    const still: typeof jobs = [];
    let i = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (i < open.length && made < LIMIT) { const job = open[i++]; if (await oneBatch(job[0], job[1], job[2], admin.id)) still.push(job); }
    }));
    open = still;
  }
  console.log(`Done. New: ${made} (live ${live}, review ${review}). Duplicates skipped: ${dup}. Unusable: ${bad}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
