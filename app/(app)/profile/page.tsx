"use client";
import { signOut } from "next-auth/react";
import ProfileForm from "@/components/ProfileForm";
import { api } from "@/components/api";

export default function ProfilePage() {
  return (
    <>
      <div className="top"><div><h1>My profile</h1><p className="sub">Update your details and privacy choices.</p></div></div>
      <div className="grid g2">
        <ProfileForm after="/dashboard" />
        <div className="card">
          <h2>Your data</h2>
          <p className="muted">Download everything we hold about you, or delete your account and all results.</p>
          <div className="row">
            <button className="btn sec" onClick={async () => {
              const data = await api("/api/me/export");
              const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
              const a = document.createElement("a"); a.href = url; a.download = "nsct-ready-my-data.json"; a.click();
            }}>Download my data</button>
            <button className="btn danger" onClick={async () => {
              if (!window.confirm("Delete your account and all your results? This cannot be undone.")) return;
              await api("/api/profile", { method: "DELETE" });
              signOut({ callbackUrl: "/" });
            }}>Delete my account</button>
          </div>
          <h2 style={{ marginTop: 24 }}>Got your NSCT result?</h2>
          <p className="muted small">Share your official score (optional). It helps us check how accurate the readiness score is.</p>
          <form className="row" onSubmit={async (e) => {
            e.preventDefault();
            const v = Number(new FormData(e.currentTarget).get("s"));
            await api("/api/actual-result", { body: { nsctScore: v } });
            alert("Thank you. Your result was saved.");
          }}>
            <input type="number" name="s" min={0} max={100} required placeholder="Score out of 100" style={{ width: 180 }} />
            <button className="btn sec" type="submit">Share</button>
          </form>
        </div>
      </div>
    </>
  );
}
