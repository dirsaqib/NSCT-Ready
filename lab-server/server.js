#!/usr/bin/env node
/*
 * NSCT Lab Server: runs a department test fully offline on a computer lab network.
 * No internet and no extra packages needed. Requires Node.js 18 or newer.
 *
 *   node server.js            (port 8080)
 *   node server.js 9000       (another port)
 *
 * Invigilator:  http://<this-pc>:8080/invigilator   (load the .nsctlab package with its passphrase)
 * Students:     http://<this-pc>:8080/
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const vm = require("vm");

const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const DATA = path.join(__dirname, "data");
const PUB = path.join(__dirname, "public");
fs.mkdirSync(DATA, { recursive: true });

// ---------- State ----------
let pkg = null;            // decrypted package: { test, questions, roster, signingKey }
let adminToken = null;     // issued after the passphrase is entered
let exam = load("exam.json", { status: "WAITING", roomCode: null, liveAt: null, endedAt: null, extraMin: 0 });
let sessions = load("sessions.json", {}); // roll -> session

function load(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8")); } catch { return fallback; }
}
const pending = {};
function writeNow(name, obj) {
  // Atomic write: a power cut never leaves a half-written file.
  const tmp = path.join(DATA, name + ".tmp");
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, path.join(DATA, name));
}
function save(name, obj, immediate) {
  if (immediate) { clearTimeout(pending[name]); pending[name] = null; return writeNow(name, obj); }
  // Throttle, never postpone: with many students saving, the file is still written at least every 300 ms.
  if (pending[name]) return;
  pending[name] = setTimeout(() => { pending[name] = null; writeNow(name, obj); }, 300);
}
const persist = (immediate) => { save("exam.json", exam, immediate); save("sessions.json", sessions, immediate); };

function decryptPackage(file, passphrase) {
  const p = JSON.parse(file);
  if (p.format !== "nsct-lab-package/1") throw new Error("This is not an NSCT lab package.");
  const key = crypto.scryptSync(passphrase, Buffer.from(p.salt, "base64"), 32, { N: 16384, r: 8, p: 1 });
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(p.iv, "base64"));
  d.setAuthTag(Buffer.from(p.tag, "base64"));
  try {
    return JSON.parse(Buffer.concat([d.update(Buffer.from(p.data, "base64")), d.final()]).toString("utf8"));
  } catch { throw new Error("Wrong passphrase."); }
}

const shuffle = (a) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const code6 = () => Array.from(crypto.randomBytes(6)).map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
const now = () => Date.now();

// ---------- Grading (for the invigilator view only; the portal grades again on import) ----------
function gradeChoice(q, chosen, partial) {
  const ans = q.answers || [];
  if (q.type !== "MULTI") return chosen.length === 1 && chosen[0] === ans[0] ? 1 : 0;
  const right = chosen.filter((c) => ans.includes(c)).length, wrong = chosen.length - right;
  if (right === ans.length && !wrong) return 1;
  return partial ? Math.max(0, (right - wrong) / ans.length) : 0;
}
// Runs JavaScript like the portal's code runner does: input on stdin, answer printed to stdout.
// Students read input with require("fs").readFileSync(0, "utf8") and print with console.log.
function runJs(q, code, onlyVisible) {
  const tests = (q.tests || []).filter((t) => !onlyVisible || !t.hidden);
  const rows = tests.map((t) => {
    const out = [];
    const fsShim = { readFileSync: () => String(t.input) };
    const ctx = vm.createContext({
      console: { log: (...a) => out.push(a.map(String).join(" ")), error: () => {} },
      require: (m) => { if (m === "fs") return fsShim; throw new Error("Only require('fs') is available."); },
      process: { stdin: { fd: 0 } },
    });
    try {
      vm.runInContext(code, ctx, { timeout: 2000 });
      const got = out.join("\n").trim();
      return { input: t.input, expected: t.expected, got, ok: got === String(t.expected).trim(), hidden: !!t.hidden };
    } catch (e) {
      return { input: t.input, expected: t.expected, got: "Error: " + String((e && e.message) || e).slice(0, 120), ok: false, hidden: !!t.hidden };
    }
  });
  return { passed: rows.filter((r) => r.ok).length, total: rows.length, rows };
}
function scoreOf(s) {
  let raw = 0, wrong = 0;
  for (const q of pkg.questions) {
    const a = s.answers[q.id] || {};
    if (q.type === "CODE") { raw += a.codeTotal ? (a.codePassed || 0) / a.codeTotal : 0; continue; }
    const c = gradeChoice(q, a.chosen || [], pkg.test.partialCredit);
    raw += c; if ((a.chosen || []).length && c < 1) wrong++;
  }
  return Math.round((100 * Math.max(0, raw - pkg.test.negativeMarking * wrong)) / pkg.questions.length);
}

// ---------- Helpers ----------
function send(res, code, obj, headers = {}) {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(obj));
}
function body(req, limit = 25 * 1024 * 1024) {
  return new Promise((ok, fail) => {
    let n = 0; const chunks = [];
    req.on("data", (c) => { n += c.length; if (n > limit) { fail(new Error("Too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch { fail(new Error("Bad request")); } });
  });
}
const ipOf = (req) => (req.socket.remoteAddress || "").replace(/^::ffff:/, "");
const isAdmin = (req) => adminToken && req.headers["x-admin"] === adminToken;
const sessionOf = (req) => { const t = req.headers["x-session"]; return Object.values(sessions).find((s) => s.token === t) || null; };
const endsAt = (s) => s.startedAt + (pkg.test.durationMin * (1 + (s.extraPct || 0) / 100) + (exam.extraMin || 0)) * 60000;
const timeUp = (s) => now() > endsAt(s) + 30000;

function finish(s) {
  if (s.submittedAt) return;
  for (const q of pkg.questions) if (q.type === "CODE") {
    const a = s.answers[q.id] || (s.answers[q.id] = {});
    if ((a.code || "").trim()) { const r = runJs(q, a.code, false); a.codePassed = r.passed; a.codeTotal = r.total; }
  }
  s.submittedAt = now();
  s.score = scoreOf(s);
}

function studentView(s) {
  return {
    title: pkg.test.title, name: s.name, roll: s.roll, endsAt: endsAt(s), serverNow: now(), submitted: !!s.submittedAt,
    items: s.order.map((qid) => {
      const q = pkg.questions.find((x) => x.id === qid);
      const a = s.answers[qid] || {};
      const order = s.optionOrder[qid] || [];
      return {
        id: qid, type: q.type, subject: q.subject, text: q.text, code: q.code, scenario: q.scenario,
        options: order.map((i) => q.options[i]), selected: (a.chosen || []).map((c) => order.indexOf(c)),
        multi: q.type === "MULTI", starterCode: q.starterCode, codeAnswer: a.code ?? null,
        sampleTests: (q.tests || []).filter((t) => !t.hidden).map((t) => ({ input: t.input, expected: t.expected })), flagged: !!a.flagged,
      };
    }),
  };
}

// ---------- Routes ----------
async function api(req, res, url) {
  const p = url.pathname;

  // Invigilator
  if (p === "/api/admin/load" && req.method === "POST") {
    const b = await body(req);
    let file = b.file;
    if (!file && fs.existsSync(path.join(DATA, "package.nsctlab"))) file = fs.readFileSync(path.join(DATA, "package.nsctlab"), "utf8");
    if (!file) return send(res, 400, { error: "Choose the .nsctlab package file." });
    try { pkg = decryptPackage(file, String(b.passphrase || "")); } catch (e) { return send(res, 400, { error: e.message }); }
    if (b.file) {
      const stored = load("package-id.json", null);
      if (stored && stored.id !== pkg.test.id && Object.keys(sessions).length) return send(res, 409, { error: "Another test's results are still on this server. Export them, then delete the data folder before loading a new test." });
      fs.writeFileSync(path.join(DATA, "package.nsctlab"), file);
      save("package-id.json", { id: pkg.test.id }, true);
    }
    adminToken = crypto.randomBytes(24).toString("hex");
    if (!exam.roomCode) { exam.roomCode = code6(); persist(true); }
    return send(res, 200, { token: adminToken });
  }
  if (p === "/api/admin/state") {
    if (!isAdmin(req)) return send(res, 401, { error: "Sign in with the passphrase." });
    const rows = pkg.roster.map((r) => {
      const s = sessions[r.roll.toUpperCase()];
      const answered = s ? Object.values(s.answers).filter((a) => (a.chosen && a.chosen.length) || (a.code || "").trim()).length : 0;
      const state = !s ? "NOT_STARTED" : s.submittedAt ? "SUBMITTED" : now() - (s.lastSeen || 0) > 60000 ? "NO_SIGNAL" : "WRITING";
      return { roll: r.roll, name: r.name, section: r.section, state, seat: s?.seat || "", ip: s?.ip || "", answered, total: pkg.questions.length, tabSwitches: s?.tabSwitches || 0, fullscreenExits: s?.fullscreenExits || 0, score: s?.submittedAt ? s.score : null, endsAt: s ? endsAt(s) : null };
    });
    return send(res, 200, { test: pkg.test, exam, questions: pkg.questions.length, rows, addresses: lanAddresses(), serverNow: now() });
  }
  if (p === "/api/admin/action" && req.method === "POST") {
    if (!isAdmin(req)) return send(res, 401, { error: "Sign in with the passphrase." });
    const b = await body(req);
    if (b.action === "start") { exam.status = "LIVE"; exam.liveAt = exam.liveAt || now(); }
    else if (b.action === "newCode") exam.roomCode = code6();
    else if (b.action === "extend") exam.extraMin = (exam.extraMin || 0) + Math.max(1, Math.min(120, Number(b.minutes) || 0));
    else if (b.action === "end") { exam.status = "ENDED"; exam.endedAt = now(); Object.values(sessions).forEach(finish); }
    else if (b.action === "reset") { const s = sessions[String(b.roll).toUpperCase()]; if (s && !s.submittedAt) delete sessions[String(b.roll).toUpperCase()]; }
    else if (b.action === "unlock") { const s = sessions[String(b.roll).toUpperCase()]; if (s) s.token = null; }
    else if (b.action === "submitOne") { const s = sessions[String(b.roll).toUpperCase()]; if (s) finish(s); }
    persist(true);
    return send(res, 200, { ok: true });
  }
  if (p === "/api/admin/export") {
    if (!isAdmin(req)) return send(res, 401, { error: "Sign in with the passphrase." });
    const results = Object.values(sessions).map((s) => ({
      roll: s.roll, seat: s.seat || null, ip: s.ip || null, startedAt: new Date(s.startedAt).toISOString(), submittedAt: s.submittedAt ? new Date(s.submittedAt).toISOString() : null,
      tabSwitches: s.tabSwitches || 0, fullscreenExits: s.fullscreenExits || 0,
      answers: pkg.questions.map((q) => { const a = s.answers[q.id] || {}; return { questionId: q.id, chosen: a.chosen || [], code: a.code ?? null, codePassed: a.codePassed, codeTotal: a.codeTotal, timeSec: Math.round(a.timeSec || 0) }; }),
    }));
    const signature = crypto.createHmac("sha256", Buffer.from(pkg.signingKey, "base64")).update(JSON.stringify({ testId: pkg.test.id, results })).digest("hex");
    const file = JSON.stringify({ format: "nsct-lab-results/1", testId: pkg.test.id, exportedAt: new Date().toISOString(), results, signature });
    fs.writeFileSync(path.join(DATA, `results-${Date.now()}.nsctresults`), file); // a backup copy stays on the PC
    res.writeHead(200, { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${pkg.test.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-results.nsctresults"` });
    return res.end(file);
  }

  // Students
  if (!pkg) return send(res, 503, { error: "The invigilator has not opened the test yet." });
  if (p === "/api/login" && req.method === "POST") {
    const b = await body(req, 10000);
    const roll = String(b.roll || "").trim().toUpperCase();
    const r = pkg.roster.find((x) => x.roll.toUpperCase() === roll);
    if (!r) return send(res, 403, { error: "This roll number is not on the list for this test." });
    if (exam.status !== "LIVE") return send(res, 409, { error: exam.status === "ENDED" ? "The test has ended." : "The test has not started yet. Wait for the invigilator." });
    if (String(b.code || "").trim().toUpperCase() !== exam.roomCode) return send(res, 403, { error: "Wrong room code. Check the board." });
    let s = sessions[roll];
    if (s && s.token) return send(res, 409, { error: "This roll number is already signed in on another PC. Ask the invigilator." });
    if (!s) {
      if (pkg.test.lateJoinMin && now() > exam.liveAt + pkg.test.lateJoinMin * 60000) return send(res, 409, { error: "Late entry time has passed. Speak to the invigilator." });
      const order = pkg.test.shuffle ? shuffle(pkg.questions.map((q) => q.id)) : pkg.questions.map((q) => q.id);
      const optionOrder = {};
      for (const q of pkg.questions) optionOrder[q.id] = q.type === "CODE" ? [] : shuffle(q.options.map((_, i) => i));
      s = sessions[roll] = { roll: r.roll, name: r.name, extraPct: r.extraPct || 0, startedAt: now(), order, optionOrder, answers: {}, tabSwitches: 0, fullscreenExits: 0 };
    }
    s.token = crypto.randomBytes(24).toString("hex");
    s.seat = String(b.seat || "").slice(0, 20); s.ip = ipOf(req); s.lastSeen = now();
    persist();
    return send(res, 200, { token: s.token });
  }
  const s = sessionOf(req);
  if (!s) return send(res, 401, { error: "Signed out. Sign in again with your roll number." });
  s.lastSeen = now();
  if (p === "/api/exam") return send(res, 200, studentView(s));
  if (p === "/api/save" && req.method === "POST") {
    if (s.submittedAt) return send(res, 409, { error: "Already submitted." });
    if (timeUp(s) || exam.status === "ENDED") { finish(s); persist(); return send(res, 409, { error: "Time is up. Your test was submitted." }); }
    const b = await body(req, 2 * 1024 * 1024);
    for (const a of b.answers || []) {
      const q = pkg.questions.find((x) => x.id === a.id); if (!q) continue;
      const cur = s.answers[q.id] || (s.answers[q.id] = {});
      if (q.type === "CODE") cur.code = String(a.code ?? "").slice(0, 20000);
      else { const order = s.optionOrder[q.id]; cur.chosen = (a.selected || []).map((i) => order[i]).filter((x) => x != null).slice(0, q.type === "MULTI" ? 6 : 1); }
      cur.flagged = !!a.flagged; cur.timeSec = Math.max(cur.timeSec || 0, Number(a.timeSec) || 0);
    }
    s.tabSwitches = Math.max(s.tabSwitches, Number(b.tabSwitches) || 0);
    s.fullscreenExits = Math.max(s.fullscreenExits, Number(b.fullscreenExits) || 0);
    persist();
    return send(res, 200, { savedAt: now() });
  }
  if (p === "/api/run" && req.method === "POST") {
    const b = await body(req, 100000);
    const q = pkg.questions.find((x) => x.id === b.id && x.type === "CODE");
    if (!q) return send(res, 404, { error: "Not a coding question." });
    const r = runJs(q, String(b.code || ""), true);
    return send(res, 200, { passed: r.passed, total: r.total, rows: r.rows });
  }
  if (p === "/api/submit" && req.method === "POST") {
    finish(s); s.token = null; persist(true);
    return send(res, 200, { submitted: true });
  }
  return send(res, 404, { error: "Not found" });
}

function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => `http://${i.address}:${PORT}`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://lab");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    const file = url.pathname === "/invigilator" ? "invigilator.html" : "index.html";
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(fs.readFileSync(path.join(PUB, file)));
  } catch (e) {
    send(res, 400, { error: e.message || "Error" });
  }
});

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { try { persist(true); } catch (e) {} process.exit(0); });

server.listen(PORT, "0.0.0.0", () => {
  console.log("\n  NSCT Lab Server is running.\n");
  console.log("  Invigilator, open on this PC:   http://localhost:" + PORT + "/invigilator");
  console.log("  Students, open on lab PCs:");
  for (const a of lanAddresses()) console.log("     " + a);
  console.log("\n  Keep this window open during the test. Press Ctrl+C to stop.\n");
});
