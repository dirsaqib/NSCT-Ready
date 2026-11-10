import Link from "next/link";

export default function Landing() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "48px 20px" }}>
      <div className="logo" style={{ padding: 0, marginBottom: 32 }}>
        <div className="logo-mark">NR</div>
        <b style={{ color: "var(--ink)", fontSize: 20 }}>NSCT Ready</b>
      </div>
      <div className="card hero" style={{ padding: 36 }}>
        <h1 style={{ color: "#fff", fontSize: 34 }}>Prepare for NSCT 2027. Free, for every student.</h1>
        <p className="muted" style={{ fontSize: 17, maxWidth: 640 }}>
          Diagnostic test, timed mock tests weighted like the real syllabus, a personal study plan to 23 January 2027, and an
          AI tutor that explains your mistakes in English or Urdu.
        </p>
        <div className="row" style={{ marginTop: 20 }}>
          <Link className="btn acc" href="/signin">Start free</Link>
          <Link className="btn sec" href="/signin">For universities</Link>
        </div>
      </div>
      <div className="grid g3" style={{ marginTop: 20 }}>
        {[
          ["Real exam feel", "Timed, computer-based mocks with a question palette, flags and auto-submit."],
          ["Know your level", "Readiness score for all 10 subjects and a predicted band."],
          ["For universities", "Chairs and focal persons see batch readiness, weak topics and at-risk students."],
        ].map(([t, d]) => (
          <div className="card" key={t}>
            <h3>{t}</h3>
            <p className="muted small" style={{ margin: 0 }}>{d}</p>
          </div>
        ))}
      </div>
      <footer className="disc">
        NSCT Ready is independent and free. It is not affiliated with or endorsed by HEC, Virtual University, PSEB, P@SHA or NCEAC.
      </footer>
    </main>
  );
}
