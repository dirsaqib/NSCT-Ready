// Seeds universities and the starter question bank. Safe to run more than once.
import { PrismaClient, type Subject } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contentHash } from "../lib/crypto";

const prisma = new PrismaClient();

const UNIVERSITIES: [string, string, string][] = [
  ["Air University, Islamabad", "Islamabad", "Islamabad Capital Territory"],
  ["Air University, Multan Campus", "Multan", "Punjab"],
  ["Air University, Aerospace and Aviation Campus Kamra", "Kamra", "Punjab"],
  ["Bahria University", "Islamabad", "Islamabad Capital Territory"],
  ["COMSATS University Islamabad", "Islamabad", "Islamabad Capital Territory"],
  ["FAST-NUCES", "Islamabad", "Islamabad Capital Territory"],
  ["NUST", "Islamabad", "Islamabad Capital Territory"],
  ["Quaid-i-Azam University", "Islamabad", "Islamabad Capital Territory"],
  ["International Islamic University Islamabad", "Islamabad", "Islamabad Capital Territory"],
  ["Riphah International University", "Islamabad", "Islamabad Capital Territory"],
  ["Capital University of Science and Technology", "Islamabad", "Islamabad Capital Territory"],
  ["SZABIST", "Karachi", "Sindh"],
  ["Foundation University", "Islamabad", "Islamabad Capital Territory"],
  ["NUML", "Islamabad", "Islamabad Capital Territory"],
  ["PMAS Arid Agriculture University", "Rawalpindi", "Punjab"],
  ["UET Lahore", "Lahore", "Punjab"],
  ["University of the Punjab", "Lahore", "Punjab"],
  ["LUMS", "Lahore", "Punjab"],
  ["Information Technology University", "Lahore", "Punjab"],
  ["University of Management and Technology", "Lahore", "Punjab"],
  ["University of Central Punjab", "Lahore", "Punjab"],
  ["GC University Lahore", "Lahore", "Punjab"],
  ["Lahore College for Women University", "Lahore", "Punjab"],
  ["University of Lahore", "Lahore", "Punjab"],
  ["Forman Christian College", "Lahore", "Punjab"],
  ["Bahauddin Zakariya University", "Multan", "Punjab"],
  ["University of Agriculture Faisalabad", "Faisalabad", "Punjab"],
  ["GC University Faisalabad", "Faisalabad", "Punjab"],
  ["University of Sargodha", "Sargodha", "Punjab"],
  ["Islamia University of Bahawalpur", "Bahawalpur", "Punjab"],
  ["University of Gujrat", "Gujrat", "Punjab"],
  ["University of Karachi", "Karachi", "Sindh"],
  ["NED University", "Karachi", "Sindh"],
  ["IBA Karachi", "Karachi", "Sindh"],
  ["Sir Syed University of Engineering and Technology", "Karachi", "Sindh"],
  ["Mehran UET", "Jamshoro", "Sindh"],
  ["University of Sindh", "Jamshoro", "Sindh"],
  ["Sukkur IBA University", "Sukkur", "Sindh"],
  ["University of Peshawar", "Peshawar", "Khyber Pakhtunkhwa"],
  ["UET Peshawar", "Peshawar", "Khyber Pakhtunkhwa"],
  ["IMSciences Peshawar", "Peshawar", "Khyber Pakhtunkhwa"],
  ["Abdul Wali Khan University Mardan", "Mardan", "Khyber Pakhtunkhwa"],
  ["Hazara University", "Mansehra", "Khyber Pakhtunkhwa"],
  ["University of Malakand", "Chakdara", "Khyber Pakhtunkhwa"],
  ["GIK Institute", "Topi", "Khyber Pakhtunkhwa"],
  ["University of Balochistan", "Quetta", "Balochistan"],
  ["BUITEMS Quetta", "Quetta", "Balochistan"],
  ["MUST Mirpur", "Mirpur", "Azad Jammu and Kashmir"],
  ["University of Azad Jammu and Kashmir", "Muzaffarabad", "Azad Jammu and Kashmir"],
  ["Karakoram International University", "Gilgit", "Gilgit-Baltistan"],
  ["Virtual University of Pakistan", "Lahore", "Punjab"],
  ["Other", "", ""],
];

type SeedQ = { id: string; s: Subject; t: string; d: number; q: string; code?: string; o: string[]; a: number; e: string };

async function main() {
  const PUBLIC = /(University of|UET|NED|Mehran|Quaid|COMSATS|NUST|NUML|GC University|Bahauddin|Islamia|Hazara|Malakand|Karakoram|Virtual University|International Islamic|Air University|Bahria|Lahore College|Abdul Wali|BUITEMS|MUST|PMAS|Sukkur IBA|IBA Karachi|IMSciences)/;
  for (const [name, city, province] of UNIVERSITIES) {
    const sector = name === "Other" ? null : PUBLIC.test(name) ? "Public" : "Private";
    const u = await prisma.university.upsert({ where: { name }, create: { name, city, province, sector }, update: { city, province, sector } });
    // Every university starts with one main campus and a computing department. Edit in Super admin > Structure.
    if (name !== "Other") {
      const c = await prisma.campus.upsert({ where: { universityId_name: { universityId: u.id, name: "Main campus" } }, create: { universityId: u.id, name: "Main campus", city }, update: {} });
      await prisma.department.upsert({
        where: { campusId_name: { campusId: c.id, name: "Computing" } },
        create: { campusId: c.id, name: "Computing", programs: ["BS Computer Science", "BS Software Engineering", "BS Information Technology", "BS Artificial Intelligence", "BS Data Science"] },
        update: {},
      });
    }
  }

  const qs: SeedQ[] = JSON.parse(readFileSync(join(process.cwd(), "seed", "questions.json"), "utf8"));
  for (const x of qs) {
    const data = { type: "SINGLE" as const, subject: x.s, topic: x.t, difficulty: x.d, text: x.q, code: x.code || null, options: x.o, answers: [x.a], explanation: x.e, source: "SEED" as const, status: "LIVE" as const, contentHash: contentHash(x.q, x.o) };
    await prisma.question.upsert({ where: { id: `seed-${x.id}` }, create: { id: `seed-${x.id}`, ...data }, update: data });
  }
  // Example multi-select, scenario and coding questions so every question type can be tried.
  const extras = [
    { id: "seed-x-multi1", type: "MULTI" as const, subject: "DB" as const, topic: "Transactions", difficulty: 2, text: "Which of these are ACID properties? Select all that apply.", options: ["Atomicity", "Consistency", "Availability", "Durability"], answers: [0, 1, 3], explanation: "ACID is Atomicity, Consistency, Isolation and Durability. Availability belongs to the CAP theorem." },
    { id: "seed-x-multi2", type: "MULTI" as const, subject: "SEC" as const, topic: "Web security", difficulty: 2, text: "Which practices reduce the risk of SQL injection? Select all that apply.", options: ["Parameterized queries", "Least-privilege database accounts", "Hiding the login page", "Input validation"], answers: [0, 1, 3], explanation: "Parameterized queries stop injection. Least privilege and validation limit the damage. Hiding a page does not." },
  ];
  for (const e of extras) {
    const { id, ...d } = e;
    await prisma.question.upsert({ where: { id }, create: { id, ...d, source: "SEED", status: "LIVE", contentHash: contentHash(d.text, d.options) }, update: {} });
  }
  const sc = await prisma.scenario.upsert({
    where: { id: "seed-scenario-1" },
    create: { id: "seed-scenario-1", title: "Online exam portal", passage: "A university runs an online exam portal. At 9:00 AM, 5,000 students log in at once. The single web server reaches 100% CPU and pages take 20 seconds to load. The database server is at 30% CPU. Session data is stored in the web server's memory." },
    update: {},
  });
  const scenarioQs = [
    { id: "seed-x-sc1", text: "What is the most likely bottleneck?", options: ["The database server", "The single web server", "The students' internet", "The DNS server"], answers: [1], explanation: "The web server is at 100% CPU while the database is at 30%." },
    { id: "seed-x-sc2", text: "What must change before adding more web servers behind a load balancer?", options: ["Move session data to a shared store such as Redis", "Increase the database size", "Use a faster DNS provider", "Nothing needs to change"], answers: [0], explanation: "Sessions in one server's memory break when requests go to different servers. A shared session store fixes this." },
  ];
  for (const s of scenarioQs) {
    const { id, ...d } = s;
    await prisma.question.upsert({ where: { id }, create: { id, type: "SCENARIO", subject: "NET", topic: "Cloud computing", difficulty: 2, scenarioId: sc.id, ...d, source: "SEED", status: "LIVE", contentHash: contentHash(d.text, d.options) }, update: {} });
  }
  await prisma.question.upsert({
    where: { id: "seed-x-code1" },
    create: {
      id: "seed-x-code1", type: "CODE", subject: "PROG", topic: "Functions", difficulty: 2, language: "python",
      text: "Read an integer n from input and print the sum of all even numbers from 1 to n.",
      starterCode: "n = int(input())\n# your code here\n", options: [], answers: [],
      tests: [{ input: "10", expected: "30", hidden: false }, { input: "1", expected: "0", hidden: false }, { input: "100", expected: "2550", hidden: true }, { input: "7", expected: "12", hidden: true }],
      explanation: "Loop from 2 to n in steps of 2 and add, or use the formula k(k+1) where k = n // 2.", source: "SEED", status: "LIVE",
    },
    update: {},
  });
  for (const [category, question, answer, order] of [
    ["Account", "How do I sign in?", "Use Google, an email link, or your mobile number with a code sent by SMS.", 1],
    ["Account", "Why is my account pending?", "Your university focal person checks your roll number. You can use the diagnostic and practice while you wait.", 2],
    ["Tests", "What happens if my internet drops during a test?", "Your answers are saved every 15 seconds and kept on your device. Keep the page open. They sync when the connection returns.", 1],
    ["Tests", "Can I get extra time?", "Students with a disability can ask their university focal person to add extra time to their account.", 2],
    ["Payments", "Do I have to pay?", "Students whose university has a plan or sponsor get Pro access free. Others can buy Pro with JazzCash, Easypaisa or a card.", 1],
  ] as [string, string, string, number][])
    await prisma.faq.create({ data: { category, question, answer, order } }).catch(() => {});
  await prisma.testWindow.create({ data: { name: "National mock 1", blueprintKey: "NATIONAL_MOCK", opensAt: new Date("2026-12-06T09:00:00+05:00"), closesAt: new Date("2026-12-07T21:00:00+05:00") } }).catch(() => {});
  console.log(`Seeded ${UNIVERSITIES.length} universities with campuses, ${qs.length + 5} questions, FAQs and a national mock window.`);
}

main().finally(() => prisma.$disconnect());
