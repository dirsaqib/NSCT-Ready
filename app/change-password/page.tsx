"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import Providers from "@/components/Providers";

/** Forced password change after signing in with a temporary password. */
export default function ChangePassword() {
  return <Providers><Form /></Providers>;
}

function Form() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="loading-screen">
      <form className="card grid" style={{ maxWidth: 420, width: "100%", gap: 10, textAlign: "left" }} onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (f.get("next") !== f.get("next2")) return setMsg("The two new passwords do not match.");
        setBusy(true); setMsg("");
        const r = await fetch("/api/me/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: f.get("current"), next: f.get("next") }) });
        const d = await r.json().catch(() => ({}));
        setBusy(false);
        if (!r.ok) return setMsg(d.error || "Could not change the password.");
        location.href = "/dashboard";
      }}>
        <div className="logo-mark">NR</div>
        <h1 style={{ margin: 0 }}>Set your own password</h1>
        <p className="muted" style={{ margin: 0 }}>You signed in with a temporary password. Choose a new one to continue.</p>
        <label className="f">Temporary password<input name="current" type="password" required autoComplete="current-password" /></label>
        <label className="f">New password<input name="next" type="password" required minLength={8} autoComplete="new-password" /></label>
        <label className="f">Confirm new password<input name="next2" type="password" required minLength={8} autoComplete="new-password" /></label>
        <span className="tiny muted">At least 8 characters with a letter and a number.</span>
        {msg && <div className="notice bad">{msg}</div>}
        <button className="btn" disabled={busy} type="submit">Save and continue</button>
        <button className="btn ghost sm" type="button" onClick={() => signOut({ callbackUrl: "/signin" })}>Sign out</button>
      </form>
    </main>
  );
}
