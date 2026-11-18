import Link from "next/link";
import SimFusionMark from "@/components/SimFusionMark";

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
          Learn by playing topic levels, take Mock 1, 2 and 3 exactly like the real test, watch top video lectures
          right here, and let the AI coach tell you what to study next.
        </p>
        <div className="row" style={{ marginTop: 20 }}>
          <Link className="btn acc" href="/signup">Register free</Link>
          <Link className="btn sec" href="/signup/focal">For university focal persons</Link>
          <Link className="btn" href="/signin" style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.6)" }}>Sign in</Link>
        </div>
      </div>
      <div className="grid g3" style={{ marginTop: 20 }}>
        {[
          ["Preparation", "Every subject is a world and every topic a level. Earn stars, XP and ranks as you learn."],
          ["Mock tests", "Three full NSCT papers that get harder, with clear guidance on what to study after each one."],
          ["Study materials", "Top video lectures for every subject, with short notes for every topic."],
        ].map(([t, d]) => (
          <div className="card" key={t}>
            <h3>{t}</h3>
            <p className="muted small" style={{ margin: 0 }}>{d}</p>
          </div>
        ))}
      </div>
      <footer className="disc" style={{ display: "grid", gap: 6, justifyItems: "center" }}>
        <SimFusionMark />
        <span>Free for every computing student in Pakistan. <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></span>
      </footer>
    </main>
  );
}
