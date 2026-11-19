// Load test for NSCT Ready. Simulates many students at once doing what a real test day looks like:
// open the dashboard, start a test, autosave answers several times, submit, open the result.
//
// Needs Node 18 or newer. No packages to install.
//
//   1. Sign in on the site as a VERIFIED test student (not staff).
//   2. In the browser press F12 > Application > Cookies > copy the value of
//      __Secure-next-auth.session-token
//   3. Run (Git Bash):
//      SITE=https://nsct-ready.vercel.app COOKIE='paste-value-here' USERS=200 node scripts/loadtest.mjs
//
// USERS = how many students at the same time (default 200). SAVES = autosaves per student (default 4).
// All virtual students share one account, which puts the same load on the server and database
// as 200 different accounts. The test creates practice attempts on that account only.

const SITE = (process.env.SITE || "https://nsct-ready.vercel.app").replace(/\/$/, "");
const COOKIE = process.env.COOKIE;
const USERS = Number(process.env.USERS || 200);
const SAVES = Number(process.env.SAVES || 4);
if (!COOKIE) { console.error("Set COOKIE to the value of __Secure-next-auth.session-token. See the top of this file."); process.exit(1); }

const headers = { "Content-Type": "application/json", Cookie: `__Secure-next-auth.session-token=${COOKIE}` };
const times = {}; const errors = {};
const note = (step, ms, ok, why) => { (times[step] ??= []).push(ms); if (!ok) (errors[step] ??= []).push(why); };

async function call(step, path, init = {}) {
  const t = Date.now();
  try {
    const r = await fetch(SITE + path, { ...init, headers });
    const body = await r.json().catch(() => ({}));
    note(step, Date.now() - t, r.ok, r.ok ? "" : `${r.status} ${body.error ?? ""}`.trim());
    return r.ok ? body : null;
  } catch (e) { note(step, Date.now() - t, false, e.message); return null; }
}

async function student(i) {
  await new Promise((r) => setTimeout(r, Math.random() * 3000)); // everyone arrives within 3 seconds
  await call("1 dashboard", "/api/me/dashboard");
  const subjects = ["PS", "PROG", "DSA", "DB", "SE", "WEB", "AI", "NET", "OS", "SEC"];
  const test = await call("2 start test", "/api/tests", { method: "POST", body: JSON.stringify({ type: "PRACTICE", subject: subjects[i % 10], count: 20 }) });
  if (!test?.id) return;
  const items = test.items ?? [];
  const answers = items.map((_, k) => ({ position: k, slots: [k % 4], flagged: false, timeSec: 20 }));
  for (let s = 0; s < SAVES; s++) {
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
    await call("3 autosave", `/api/tests/${test.id}/save`, { method: "PATCH", body: JSON.stringify({ answers: answers.slice(0, Math.ceil(((s + 1) * answers.length) / SAVES)) }) });
  }
  await call("4 submit", `/api/tests/${test.id}/submit`, { method: "POST", body: JSON.stringify({ answers }) });
  await call("5 result", `/api/tests/${test.id}`);
}

const pct = (a, p) => a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : 0;
console.log(`Load test: ${USERS} students at once on ${SITE}\n`);
const start = Date.now();
await Promise.all(Array.from({ length: USERS }, (_, i) => student(i)));
console.log(`Finished in ${((Date.now() - start) / 1000).toFixed(1)} s\n`);
console.log("Step            Requests  Failed   Median    95%      Slowest");
for (const step of Object.keys(times).sort()) {
  const a = times[step];
  console.log(`${step.padEnd(15)} ${String(a.length).padStart(8)} ${String((errors[step] ?? []).length).padStart(7)} ${String(pct(a, 50)).padStart(7)}ms ${String(pct(a, 95)).padStart(7)}ms ${String(Math.max(...a)).padStart(8)}ms`);
}
const all = Object.values(errors).flat();
if (all.length) {
  const counts = {}; all.forEach((e) => (counts[e] = (counts[e] || 0) + 1));
  console.log("\nErrors:"); Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([e, n]) => console.log(`  ${n} x ${e}`));
} else console.log("\nNo errors.");
console.log("\nGood: 95% under 2,000 ms for every step and no errors. Send me this table if anything looks slow.");
