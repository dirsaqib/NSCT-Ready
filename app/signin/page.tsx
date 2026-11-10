"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";

/** Sign in with Google, an email link, or a mobile number and SMS code. */
export default function SignIn() {
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"enter" | "code" | "sent">("enter");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setBusy(true); setMsg("");
    const r = await fetch("/api/auth/otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(d.error || "Could not send the code.");
    setStep("code");
  };
  const verify = async () => {
    setBusy(true); setMsg("");
    const r = await signIn("phone", { phone, code, redirect: false, callbackUrl: "/dashboard" });
    setBusy(false);
    if (r?.error) return setMsg("That code is wrong or has expired. Request a new code.");
    location.href = "/dashboard";
  };

  return (
    <main className="loading-screen">
      <div className="card" style={{ maxWidth: 420, width: "100%" }}>
        <div className="logo-mark" style={{ marginBottom: 14 }}>NR</div>
        <h1>Sign in to NSCT Ready</h1>
        <p className="muted">For every computing student in Pakistan.</p>
        <button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>Continue with Google</button>
        <div className="tabs" style={{ marginTop: 16 }}>
          <button className={mode === "phone" ? "on" : ""} onClick={() => setMode("phone")}>Mobile number</button>
          <button className={mode === "email" ? "on" : ""} onClick={() => setMode("email")}>Email link</button>
        </div>
        {mode === "phone" ? (
          step === "enter" ? (
            <div className="grid" style={{ gap: 10 }}>
              <input type="tel" placeholder="0300 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <button className="btn sec" disabled={busy || phone.replace(/\D/g, "").length < 10} onClick={sendCode}>Send code by SMS</button>
            </div>
          ) : (
            <div className="grid" style={{ gap: 10 }}>
              <p className="small">Enter the 6 digit code sent to {phone}.</p>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              <button className="btn" disabled={busy || code.length !== 6} onClick={verify}>Sign in</button>
              <button className="btn ghost sm" onClick={() => { setStep("enter"); setCode(""); }}>Use a different number</button>
            </div>
          )
        ) : step === "sent" ? (
          <div className="notice info">Check your inbox for the sign-in link. It works once and expires in 24 hours.</div>
        ) : (
          <form className="grid" style={{ gap: 10 }} onSubmit={async (e) => { e.preventDefault(); await signIn("email", { email, callbackUrl: "/dashboard", redirect: false }); setStep("sent"); }}>
            <input type="email" required placeholder="you@university.edu.pk" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn sec" type="submit">Email me a link</button>
          </form>
        )}
        {msg && <div className="notice bad" style={{ marginTop: 12 }}>{msg}</div>}
        <p className="tiny muted" style={{ marginTop: 16 }}>By signing in you agree to the <a href="/terms">terms</a> and <a href="/privacy">privacy policy</a>.</p>
      </div>
    </main>
  );
}
