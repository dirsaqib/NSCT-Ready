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
  ["Fatima Jinnah Women University", "Rawalpindi", "Punjab"],
  ["Institute of Space Technology", "Islamabad", "Islamabad Capital Territory"],
  ["PIEAS", "Islamabad", "Islamabad Capital Territory"],
  ["HITEC University", "Taxila", "Punjab"],
  ["UET Taxila", "Taxila", "Punjab"],
  ["University of Wah", "Wah Cantt", "Punjab"],
  ["Iqra University", "Karachi", "Sindh"],
  ["Hamdard University", "Karachi", "Sindh"],
  ["DHA Suffa University", "Karachi", "Sindh"],
  ["Habib University", "Karachi", "Sindh"],
  ["Muhammad Ali Jinnah University", "Karachi", "Sindh"],
  ["Dawood University of Engineering and Technology", "Karachi", "Sindh"],
  ["Federal Urdu University", "Karachi", "Sindh"],
  ["Indus University", "Karachi", "Sindh"],
  ["Shah Abdul Latif University", "Khairpur", "Sindh"],
  ["Quaid-e-Awam UEST Nawabshah", "Nawabshah", "Sindh"],
  ["Lahore Garrison University", "Lahore", "Punjab"],
  ["Superior University", "Lahore", "Punjab"],
  ["Minhaj University Lahore", "Lahore", "Punjab"],
  ["University of Education Lahore", "Lahore", "Punjab"],
  ["Kinnaird College for Women", "Lahore", "Punjab"],
  ["University of South Asia", "Lahore", "Punjab"],
  ["National Textile University", "Faisalabad", "Punjab"],
  ["Government College Women University Sialkot", "Sialkot", "Punjab"],
  ["University of Sialkot", "Sialkot", "Punjab"],
  ["University of Okara", "Okara", "Punjab"],
  ["University of Sahiwal", "Sahiwal", "Punjab"],
  ["Ghazi University", "Dera Ghazi Khan", "Punjab"],
  ["Khwaja Fareed UEIT", "Rahim Yar Khan", "Punjab"],
  ["NFC Institute of Engineering and Technology", "Multan", "Punjab"],
  ["Women University Multan", "Multan", "Punjab"],
  ["Emerson University Multan", "Multan", "Punjab"],
  ["University of Mianwali", "Mianwali", "Punjab"],
  ["University of Jhang", "Jhang", "Punjab"],
  ["UET Mardan", "Mardan", "Khyber Pakhtunkhwa"],
  ["Islamia College Peshawar", "Peshawar", "Khyber Pakhtunkhwa"],
  ["Kohat University of Science and Technology", "Kohat", "Khyber Pakhtunkhwa"],
  ["University of Swat", "Swat", "Khyber Pakhtunkhwa"],
  ["Gomal University", "Dera Ismail Khan", "Khyber Pakhtunkhwa"],
  ["City University of Science and IT", "Peshawar", "Khyber Pakhtunkhwa"],
  ["Shaheed Benazir Bhutto Women University", "Peshawar", "Khyber Pakhtunkhwa"],
  ["University of Engineering and Applied Sciences Swat", "Swat", "Khyber Pakhtunkhwa"],
  ["Sardar Bahadur Khan Women's University", "Quetta", "Balochistan"],
  ["University of Turbat", "Turbat", "Balochistan"],
  ["Lasbela University", "Uthal", "Balochistan"],
  ["University of Kotli", "Kotli", "Azad Jammu and Kashmir"],
  ["Women University of AJK Bagh", "Bagh", "Azad Jammu and Kashmir"],
  ["University of Baltistan", "Skardu", "Gilgit-Baltistan"],
  ["Other", "", ""],
];

/** Universities with several campuses that run computing programs. */
const CAMPUSES: Record<string, [string, string][]> = {
  "FAST-NUCES": [["Islamabad", "Islamabad"], ["Lahore", "Lahore"], ["Karachi", "Karachi"], ["Peshawar", "Peshawar"], ["Chiniot-Faisalabad", "Chiniot"], ["Multan", "Multan"]],
  "COMSATS University Islamabad": [["Islamabad", "Islamabad"], ["Lahore", "Lahore"], ["Wah", "Wah Cantt"], ["Abbottabad", "Abbottabad"], ["Attock", "Attock"], ["Sahiwal", "Sahiwal"], ["Vehari", "Vehari"]],
  "Bahria University": [["Islamabad", "Islamabad"], ["Lahore", "Lahore"], ["Karachi", "Karachi"]],
  "NUML": [["Islamabad", "Islamabad"], ["Lahore", "Lahore"], ["Karachi", "Karachi"], ["Rawalpindi", "Rawalpindi"]],
  "University of the Punjab": [["Lahore (Quaid-e-Azam Campus)", "Lahore"], ["Gujranwala", "Gujranwala"], ["Jhelum", "Jhelum"]],
  "Virtual University of Pakistan": [["Online", "Lahore"]],
};
const COMPUTING_PROGRAMS = ["BS Computer Science", "BS Software Engineering", "BS Information Technology", "BS Artificial Intelligence", "BS Data Science", "BS Cyber Security"];

type SeedQ = { id: string; s: Subject; t: string; d: number; q: string; code?: string; o: string[]; a: number; e: string };

async function main() {
  // Runs on every Vercel build. Each part checks what is already there and fills only what is missing,
  // so builds stay fast and edits made in the admin panel are never overwritten. FORCE_SEED=1 runs everything.
  const force = !!process.env.FORCE_SEED;
  const uniCount = await prisma.university.count();
  if (force || uniCount < UNIVERSITIES.length) {
  const PUBLIC = /(University of|UET|NED|Mehran|Quaid|COMSATS|NUST|NUML|GC University|Bahauddin|Islamia|Hazara|Malakand|Karakoram|Virtual University|International Islamic|Air University|Bahria|Lahore College|Abdul Wali|BUITEMS|MUST|PMAS|Sukkur IBA|IBA Karachi|IMSciences)/;
  for (const [name, city, province] of UNIVERSITIES) {
    const sector = name === "Other" ? null : PUBLIC.test(name) ? "Public" : "Private";
    const u = await prisma.university.upsert({ where: { name }, create: { name, city, province, sector }, update: { city, province, sector } });
    // Every university starts with one main campus and a computing department. Edit in Super admin > Structure.
    if (name !== "Other" && name !== "Air University, Islamabad" && !CAMPUSES[name]) {
      const c = await prisma.campus.upsert({ where: { universityId_name: { universityId: u.id, name: "Main campus" } }, create: { universityId: u.id, name: "Main campus", city }, update: {} });
      await prisma.department.upsert({
        where: { campusId_name: { campusId: c.id, name: "Computing" } },
        create: { campusId: c.id, name: "Computing", programs: ["BS Computer Science", "BS Software Engineering", "BS Information Technology", "BS Artificial Intelligence", "BS Data Science"] },
        update: {},
      });
    }
  }

  // Air University, Islamabad: Faculty of Computing and AI departments for the pilot.
  const au = await prisma.university.findUnique({ where: { name: "Air University, Islamabad" } });
  if (au) {
    const c = await prisma.campus.upsert({ where: { universityId_name: { universityId: au.id, name: "Main campus" } }, create: { universityId: au.id, name: "Main campus", city: "Islamabad" }, update: {} });
    for (const [name, programs] of [
      ["Computer Games Development", ["BS Computer Games Development"]],
      ["Computer Science", ["BS Computer Science", "BS Information Technology", "BS Bioinformatics"]],
      ["Creative Technology", ["BS Artificial Intelligence", "BS Software Engineering", "BS Data Science"]],
    ] as [string, string[]][]) {
      await prisma.department.upsert({ where: { campusId_name: { campusId: c.id, name } }, create: { campusId: c.id, name, programs }, update: { programs } });
    }
  }
  for (const [uni, list] of Object.entries(CAMPUSES)) {
    const u = await prisma.university.findUnique({ where: { name: uni } });
    if (!u) continue;
    for (const [campus, city] of list) {
      const c = await prisma.campus.upsert({ where: { universityId_name: { universityId: u.id, name: campus } }, create: { universityId: u.id, name: campus, city }, update: {} });
      await prisma.department.upsert({ where: { campusId_name: { campusId: c.id, name: "Computing" } }, create: { campusId: c.id, name: "Computing", programs: COMPUTING_PROGRAMS }, update: {} });
    }
  }
  console.log(`Seed: universities ready (${await prisma.university.count()}).`);
  }

  // ---------- Question bank: starter questions for every subject and every question type ----------
  const qs: SeedQ[] = [
    ...JSON.parse(readFileSync(join(process.cwd(), "seed", "questions.json"), "utf8")),
    ...JSON.parse(readFileSync(join(process.cwd(), "seed", "questions2.json"), "utf8")),
  ];
  const seeded = await prisma.question.count({ where: { source: "SEED" } });
  if (force || seeded < qs.length + 5) {
    // createMany with skipDuplicates is one query, so it is fast even from a distant build region.
    await prisma.question.createMany({
      skipDuplicates: true,
      data: qs.map((x) => ({ id: `seed-${x.id}`, type: "SINGLE" as const, subject: x.s, topic: x.t, difficulty: x.d, text: x.q, code: x.code || null, options: x.o, answers: [x.a], explanation: x.e, source: "SEED" as const, status: "LIVE" as const, contentHash: contentHash(x.q, x.o) })),
    });
    // Example multi-select, scenario and coding questions so every question type can be tried.
    const extras = [
      { id: "seed-x-multi1", type: "MULTI" as const, subject: "DB" as const, topic: "Transactions", difficulty: 2, text: "Which of these are ACID properties? Select all that apply.", options: ["Atomicity", "Consistency", "Availability", "Durability"], answers: [0, 1, 3], explanation: "ACID is Atomicity, Consistency, Isolation and Durability. Availability belongs to the CAP theorem." },
      { id: "seed-x-multi2", type: "MULTI" as const, subject: "SEC" as const, topic: "Web security", difficulty: 2, text: "Which practices reduce the risk of SQL injection? Select all that apply.", options: ["Parameterized queries", "Least-privilege database accounts", "Hiding the login page", "Input validation"], answers: [0, 1, 3], explanation: "Parameterized queries stop injection. Least privilege and validation limit the damage. Hiding a page does not." },
      { id: "seed-x-multi3", type: "MULTI" as const, subject: "NET" as const, topic: "Transport layer", difficulty: 2, text: "Which statements about TCP are true? Select all that apply.", options: ["It retransmits lost segments", "It has no connection setup", "It delivers data in order", "It uses a three-way handshake"], answers: [0, 2, 3], explanation: "TCP is connection-based, reliable and ordered. UDP is the one without connection setup." },
      { id: "seed-x-multi4", type: "MULTI" as const, subject: "AI" as const, topic: "Regularization", difficulty: 2, text: "Which techniques help reduce overfitting? Select all that apply.", options: ["Dropout", "More training data", "Training for many more epochs", "L2 regularisation"], answers: [0, 1, 3], explanation: "Dropout, more data and L2 all reduce overfitting. Training longer usually makes it worse." },
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
    for (const q of scenarioQs) {
      const { id, ...d } = q;
      await prisma.question.upsert({ where: { id }, create: { id, type: "SCENARIO", subject: "NET", topic: "Cloud computing", difficulty: 2, scenarioId: sc.id, ...d, source: "SEED", status: "LIVE", contentHash: contentHash(d.text, d.options) }, update: {} });
    }
    const sc2 = await prisma.scenario.upsert({
      where: { id: "seed-scenario-2" },
      create: { id: "seed-scenario-2", title: "Startup delivery app", passage: "A Lahore startup must launch a food delivery app in 3 months. The client changes requirements every few weeks and wants to see working features often. The team has 5 developers and no tester." },
      update: {},
    });
    const scenario2 = [
      { id: "seed-x-sc3", topic: "Process models", text: "Which process model fits this project best?", options: ["Waterfall", "Scrum", "V-model", "Big bang"], answers: [1], explanation: "Scrum delivers working increments every sprint and absorbs changing requirements." },
      { id: "seed-x-sc4", topic: "Testing", text: "With no tester, what best protects existing features as requirements keep changing?", options: ["Manual testing at the end", "Automated regression tests run on every commit", "A two-month code freeze", "Skipping tests to save time"], answers: [1], explanation: "Automated tests in continuous integration catch broken features within minutes." },
    ];
    for (const q of scenario2) {
      const { id, ...d } = q;
      await prisma.question.upsert({ where: { id }, create: { id, type: "SCENARIO", subject: "SE", difficulty: 2, scenarioId: sc2.id, ...d, source: "SEED", status: "LIVE", contentHash: contentHash(d.text, d.options) }, update: {} });
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
    await prisma.question.upsert({
      where: { id: "seed-x-code2" },
      create: {
        id: "seed-x-code2", type: "CODE", subject: "DSA", topic: "Arrays", difficulty: 2, language: "javascript",
        text: "The input is one line of space-separated integers. Print the largest number.",
        starterCode: "const nums = require(\"fs\").readFileSync(0, \"utf8\").trim().split(/\\s+/).map(Number);\n// print the largest number\n", options: [], answers: [],
        tests: [{ input: "3 9 2", expected: "9", hidden: false }, { input: "-5 -2 -9", expected: "-2", hidden: true }, { input: "7", expected: "7", hidden: true }],
        explanation: "Start with the first number and keep the larger one as you go, so arrays of negative numbers also work.", source: "SEED", status: "LIVE",
      },
      update: {},
    });
    console.log(`Seed: question bank ready (${await prisma.question.count({ where: { status: "LIVE" } })} live questions).`);
  }

  // ---------- Lessons for every subject ----------
  if (force || (await prisma.lesson.count()) === 0) {
    const lessons: { subject: Subject; topic: string; title: string; notes: string; videoUrl: string | null; order: number }[] = JSON.parse(readFileSync(join(process.cwd(), "seed", "lessons.json"), "utf8"));
    for (const l of lessons) if (!(await prisma.lesson.count({ where: { subject: l.subject, title: l.title } }))) await prisma.lesson.create({ data: l });
    console.log(`Seed: ${lessons.length} lessons ready.`);
  }

  // ---------- Test blueprints (editable in Super admin > Tests and schedule) ----------
  const blueprints = [
    { key: "DIAGNOSTIC", name: "Diagnostic test", counts: { PS: 4, PROG: 2, DSA: 2, DB: 2, SE: 2, WEB: 2, AI: 2, NET: 2, OS: 1, SEC: 1 }, durationMin: 25, passMark: 50, negativeMarking: 0 },
    { key: "MOCK", name: "Full mock test", counts: { PS: 12, PROG: 6, DSA: 6, DB: 6, SE: 6, WEB: 6, AI: 6, NET: 6, OS: 3, SEC: 3 }, durationMin: 60, passMark: 50, negativeMarking: 0 },
    { key: "NATIONAL_MOCK", name: "National mock test", counts: { PS: 12, PROG: 6, DSA: 6, DB: 6, SE: 6, WEB: 6, AI: 6, NET: 6, OS: 3, SEC: 3 }, durationMin: 60, passMark: 50, negativeMarking: 0 },
  ];
  for (const b of blueprints) if (!(await prisma.blueprint.count({ where: { key: b.key } }))) await prisma.blueprint.create({ data: { ...b, difficulty: { 1: 30, 2: 50, 3: 20 } } });

  // ---------- Help centre FAQ ----------
  for (const [category, question, answer, order] of [
    ["Account", "How do I sign in?", "Use Google, an email link, or your mobile number with a code sent by SMS.", 1],
    ["Account", "Do I need a CNIC?", "No. You register with your university roll number. Your university focal person verifies it.", 2],
    ["Account", "Why is my account pending?", "Your university focal person checks your roll number. You can use the diagnostic, practice and lessons while you wait.", 3],
    ["Account", "My university or department is not in the list", "Choose Other for now and send a support request with the correct name. The team adds it within 2 working days.", 4],
    ["Tests", "What happens if my internet drops during a test?", "Your answers are saved every 15 seconds and kept on your device. Keep the page open. They sync when the connection returns.", 1],
    ["Tests", "Why does the test go full screen?", "Mock tests follow exam rules: full screen, no copy and paste, and leaving the window is recorded. Flagged tests do not receive certificates.", 2],
    ["Tests", "Can I get extra time?", "Students with a disability can ask their university focal person to add extra time to their account.", 3],
    ["Tests", "I think an answer key is wrong", "On your result page press Request re-check on that question. The team replies within 2 working days.", 4],
    ["Tests", "What is a lab test?", "A test your department runs in a computer lab. Your invigilator shows an access code on the board. Results appear after the department releases them.", 5],
    ["Certificates", "How do I get a certificate?", "Pass a full mock or the national mock with no integrity flags, on a verified account. Employers can check it with its code.", 1],
    ["Payments", "Do I have to pay?", "No. Core preparation is free. Students whose university has a plan or sponsor get Pro free. Others can buy Pro with JazzCash, Easypaisa or a card.", 1],
    ["About NSCT", "When is NSCT 2027?", "HEC has announced 23 January 2027. Check the official HEC website for any change.", 1],
    ["About NSCT", "Is NSCT Ready an official HEC platform?", "No. NSCT Ready is an independent preparation platform and is not affiliated with HEC, PSEB or P@SHA.", 2],
  ] as [string, string, string, number][])
    if (!(await prisma.faq.count({ where: { question } }))) await prisma.faq.create({ data: { category, question, answer, order } });

  // ---------- National mock window and a starter feedback survey ----------
  if (!(await prisma.testWindow.count({ where: { name: "National mock 1" } }))) await prisma.testWindow.create({ data: { name: "National mock 1", blueprintKey: "NATIONAL_MOCK", opensAt: new Date("2026-12-06T09:00:00+05:00"), closesAt: new Date("2026-12-07T21:00:00+05:00") } });
  if (!(await prisma.testWindow.count({ where: { name: "National mock 2" } }))) await prisma.testWindow.create({ data: { name: "National mock 2", blueprintKey: "NATIONAL_MOCK", opensAt: new Date("2027-01-09T09:00:00+05:00"), closesAt: new Date("2027-01-10T21:00:00+05:00") } });
  if (!(await prisma.survey.count())) await prisma.survey.create({ data: {
    title: "How is NSCT Ready working for you?", audience: "STUDENT", active: true,
    questions: [{ q: "How useful are the mock tests?", type: "scale" }, { q: "How clear are the explanations?", type: "scale" }, { q: "How easy is the site to use?", type: "scale" }, { q: "What should we add or improve?", type: "text" }],
  } });
  console.log("Seed: complete.");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
