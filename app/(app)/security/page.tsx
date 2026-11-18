"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Page, Card, useApi, Loading } from "@/components/ui";

/** Two-factor authentication for anyone. Required for staff, optional for students. */
export default function Security() {
  const { data, error, reload } = useApi<{ account: { totpEnabled: boolean; email: string | null; phone: string | null } }>("/api/profile");
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [pw, setPw] = useState("");
  if (!data) return <Loading error={error} />;
  const on = data.account?.totpEnabled;
  return (
    <Page title="Security" sub="Change your password and protect your account with a second step at sign-in.">
      <Card title="Change password">
        <form className="grid" style={{ gap: 10, maxWidth: 360 }} onSubmit={async (e) => {
          e.preventDefault();
          const el = e.currentTarget; const f = new FormData(el);
          if (f.get("next") !== f.get("next2")) return setPw("The two new passwords do not match.");
          try { await api("/api/me/password", { body: { current: f.get("current"), next: f.get("next") } }); el.reset(); setPw("Password changed."); } catch (er) { setPw((er as Error).message); }
        }}>
          <input name="current" type="password" required placeholder="Current password" autoComplete="current-password" />
          <input name="next" type="password" required minLength={8} placeholder="New password" autoComplete="new-password" />
          <input name="next2" type="password" required minLength={8} placeholder="Confirm new password" autoComplete="new-password" />
          <button className="btn sec" type="submit">Change password</button>
          {pw && <div className="notice">{pw}</div>}
        </form>
      </Card>
      <Card title="Two-factor authentication">
        <p>Status: <b>{on ? "On" : "Off"}</b></p>
        {!on && !setup && <button className="btn" onClick={async () => setSetup(await api("/api/me/2fa"))}>Turn on</button>}
        {setup && (
          <div className="grid" style={{ gap: 10, maxWidth: 360 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="QR code" width={180} height={180} />
            <p className="tiny muted">Key: <code>{setup.secret}</code></p>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input type="text" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
              <button className="btn" onClick={async () => { try { await api("/api/me/2fa", { body: { code } }); setSetup(null); reload(); } catch (e) { setMsg((e as Error).message); } }}>Confirm</button>
            </div>
          </div>
        )}
        {on && <button className="btn sec" onClick={async () => { try { await api("/api/me/2fa", { method: "DELETE" }); reload(); } catch (e) { setMsg((e as Error).message); } }}>Turn off</button>}
        {msg && <div className="notice bad" style={{ marginTop: 10 }}>{msg}</div>}
        <p className="small muted" style={{ marginTop: 14 }}>Signed in as {data.account?.email || data.account?.phone || "your roll number"}. Accounts lock for 15 minutes after 5 wrong passwords or codes.</p>
      </Card>
    </Page>
  );
}
