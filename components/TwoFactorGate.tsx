"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "./api";

/** Staff must set up and then enter an authenticator code before their panel opens. */
export default function TwoFactorGate({ setup }: { setup: boolean }) {
  const { update } = useSession();
  const [qr, setQr] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { if (setup) api<{ qr: string; secret: string }>("/api/me/2fa").then(setQr).catch((e) => setMsg(e.message)); }, [setup]);
  const verify = async () => {
    setMsg("");
    try {
      if (setup) await api("/api/me/2fa", { body: { code } });
      const s = await update({ totp: code });
      if ((s?.user as { tfa?: boolean })?.tfa) location.reload();
      else setMsg("That code did not work. Wait for a new code and try again. After 5 wrong tries the account locks for 15 minutes.");
    } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <div className="loading-screen">
      <div className="card" style={{ maxWidth: 460 }}>
        <h1>{setup ? "Set up two-factor authentication" : "Enter your authenticator code"}</h1>
        <p className="muted">Your role can see student data, so a second step is required at every sign-in.</p>
        {setup && qr && (
          <>
            <p className="small">1. Install Google Authenticator or Microsoft Authenticator. 2. Scan this code. 3. Enter the 6 digit code it shows.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.qr} alt="Authenticator QR code" width={180} height={180} />
            <p className="tiny muted">Cannot scan? Enter this key: <code>{qr.secret}</code></p>
          </>
        )}
        <div className="row" style={{ marginTop: 12, flexWrap: "nowrap" }}>
          <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <button className="btn" disabled={code.length !== 6} onClick={verify}>Verify</button>
        </div>
        {msg && <div className="notice bad" style={{ marginTop: 12 }}>{msg}</div>}
      </div>
    </div>
  );
}
