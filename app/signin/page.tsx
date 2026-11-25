"use client";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import SearchSelect from "@/components/SearchSelect";
import { AKA } from "@/components/universityAka";

const ERRORS: Record<string, string> = {
  CredentialsSignin: "Login details or password are wrong. Check that you chose your university and typed your roll number exactly as the university gave it. After 5 wrong tries the account locks for 15 minutes.",
  LOCKED: "Too many wrong tries. The account is locked for 15 minutes.",
  BLOCKED: "This account is deactivated. Contact your university focal person.",
  PENDING_APPROVAL: "Your focal person registration is waiting for approval by the NSCT super admin. You will get an email once it is approved.",
};

/** Sign in with a password. Students: university plus roll number, or email. Staff: email. */
export default function SignIn() {
  const [mode, setMode] = useState<"student" | "staff">("student");
  const [unis, setUnis] = useState<{ id: string; name: string }[]>([]);
  const [universityId, setUni] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/universities").then((r) => r.json()).then((x) => setUnis(x.universities ?? [])).catch(() => {});
    const q = new URLSearchParams(location.search);
    if (q.get("pending")) setMsg(ERRORS.PENDING_APPROVAL);
    setRegistered(q.get("registered"));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    const r = await signIn("password", { login, password, universityId: mode === "student" && !login.includes("@") ? universityId : "", redirect: false });
    setBusy(false);
    if (r?.error) return setMsg(r.error === "CredentialsSignin" && mode === "student" && !login.includes("@") && !universityId ? "We could not sign you in with this roll number alone. Choose your university from the list and try again, or check your password." : ERRORS[r.error] ?? `Sign-in failed: ${r.error}`);
    location.href = "/dashboard";
  };

  return (
    <main className="loading-screen">
      <div className="card" style={{ maxWidth: 440, width: "100%" }}>
        <img src="/tayari-icon.png" alt="TayariHub" width={52} height={52} style={{ marginBottom: 10 }} />
        <h1>Sign in to TayariHub</h1>
        <p className="muted">For every computing student in Pakistan.</p>
        {registered && <div className="notice info">Registration received. {registered === "focal" ? "The NSCT super admin will review it." : "You can sign in now. Full mocks unlock once your focal person approves you."}</div>}
        <div className="tabs" style={{ marginTop: 8 }}>
          <button type="button" className={mode === "student" ? "on" : ""} onClick={() => setMode("student")}>Student</button>
          <button type="button" className={mode === "staff" ? "on" : ""} onClick={() => setMode("staff")}>Focal person or admin</button>
        </div>
        <form className="grid" style={{ gap: 10 }} onSubmit={submit}>
          {mode === "student" && !login.includes("@") && (
            <label className="f"><span>University <span className="tiny muted">(recommended)</span></span>
              <SearchSelect options={unis.map((u) => ({ id: u.id, name: u.name, hint: (u as { city?: string }).city, keywords: AKA[u.name] }))} value={universityId} onChange={setUni} placeholder="Type to search your university" />
              <span className="tiny muted">You can sign in with just your roll number if it is unique. If another university has the same roll number, choose your university.</span>
            </label>
          )}
          <label className="f">{mode === "student" ? "Roll number or email" : "Official email"}
            <input type={mode === "staff" ? "email" : "text"} required autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} placeholder={mode === "student" ? "As on your university card" : "you@university.edu.pk"} />
          </label>
          <label className="f">Password<input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <button className="btn" disabled={busy} type="submit">{busy ? "Signing in" : "Sign in"}</button>
        </form>
        {msg && <div className="notice bad" style={{ marginTop: 12 }}>{msg}</div>}
        <div className="small" style={{ marginTop: 16, display: "grid", gap: 6 }}>
          {mode === "student"
            ? <span>New student? <a href="/signup">Register with your enrollment proof</a></span>
            : <span>University focal person? <a href="/signup/focal">Register your university</a></span>}
          <span className="muted">Forgot your password? Students ask their focal person to reset it. Focal persons contact the NSCT super admin.</span>
        </div>
        <p className="tiny muted" style={{ marginTop: 16 }}>By signing in you agree to the <a href="/terms">terms</a> and <a href="/privacy">privacy policy</a>.</p>
      </div>
    </main>
  );
}
