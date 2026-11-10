// Runs student code safely in Judge0 (self-hosted or RapidAPI). Never run student code on the app server.
// Set JUDGE0_URL (and JUDGE0_KEY for RapidAPI).
const LANG: Record<string, number> = { python: 71, cpp: 54, java: 62, javascript: 63 };

export type CodeTest = { input: string; expected: string; hidden?: boolean };

async function runOne(language: string, source: string, stdin: string) {
  const url = process.env.JUDGE0_URL;
  if (!url) throw new Error("JUDGE0_URL not configured");
  const r = await fetch(`${url}/submissions?base64_encoded=false&wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.JUDGE0_KEY ? { "X-RapidAPI-Key": process.env.JUDGE0_KEY } : {}) },
    body: JSON.stringify({ language_id: LANG[language], source_code: source, stdin, cpu_time_limit: 2, memory_limit: 128000 }),
  });
  if (!r.ok) throw new Error(`Code runner error ${r.status}`);
  const j = (await r.json()) as { stdout?: string; stderr?: string; compile_output?: string; status?: { description: string } };
  return { stdout: (j.stdout ?? "").trim(), error: j.compile_output || j.stderr || (j.status?.description !== "Accepted" ? j.status?.description : "") || "" };
}

/** Runs every test. Hidden tests return pass or fail only, never their input or expected output. */
export async function runTests(language: string, source: string, tests: CodeTest[]) {
  if (!LANG[language]) throw new Error("Unsupported language");
  if (source.length > 20000) throw new Error("Code is too long");
  const results = [];
  for (const t of tests.slice(0, 20)) {
    const out = await runOne(language, source, t.input);
    const pass = !out.error && out.stdout === t.expected.trim();
    results.push(t.hidden ? { pass, hidden: true } : { pass, input: t.input, expected: t.expected, got: out.stdout, error: out.error.slice(0, 500) });
  }
  return { passed: results.filter((r) => r.pass).length, total: results.length, results };
}
