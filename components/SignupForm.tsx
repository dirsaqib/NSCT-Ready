"use client";
import { useEffect, useState } from "react";

const PROGRAMS = ["BS Computer Science", "BS Software Engineering", "BS Information Technology", "BS Artificial Intelligence", "BS Data Science", "BS Cyber Security", "BS Computer Games Development", "BS Bioinformatics", "Other computing program"];
type Campus = { id: string; name: string; departments: { id: string; name: string; programs: string[] }[] };

/** Public registration form. Students attach enrollment proof, focal persons attach an appointment letter. */
export default function SignupForm({ kind }: { kind: "student" | "focal" }) {
  const [unis, setUnis] = useState<{ id: string; name: string }[]>([]);
  const [uni, setUni] = useState("");
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campus, setCampus] = useState("");
  const [dept, setDept] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch("/api/universities").then((r) => r.json()).then((x) => setUnis(x.universities ?? [])).catch(() => {}); }, []);
  useEffect(() => {
    setCampuses([]);
    if (uni) fetch(`/api/universities/${uni}/structure`).then((r) => r.json()).then((x) => setCampuses(x.campuses ?? [])).catch(() => {});
  }, [uni]);
  const depts = campuses.find((c) => c.id === campus)?.departments ?? [];
  const progs = depts.find((d) => d.id === dept)?.programs?.length ? depts.find((d) => d.id === dept)!.programs : PROGRAMS;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.get("password") !== fd.get("password2")) return setMsg("The two passwords do not match.");
    fd.delete("password2");
    const f = fd.get("proof") as File | null;
    if (f && f.size > 2 * 1024 * 1024) return setMsg("The proof file must be 2 MB or smaller.");
    setBusy(true); setMsg("");
    const r = await fetch(`/api/signup/${kind}`, { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(d.issues?.[0] ? `${d.issues[0].path?.join(".")}: ${d.issues[0].message}` : d.error || "Could not register.");
    location.href = `/signin?registered=${kind}`;
  };

  return (
    <main className="loading-screen">
      <form className="card grid" style={{ maxWidth: 680, width: "100%", gap: 12, textAlign: "left" }} onSubmit={submit}>
        <div className="logo-mark">NR</div>
        <h1 style={{ margin: 0 }}>{kind === "student" ? "Student registration" : "Focal person registration"}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {kind === "student"
            ? "Fill in your details and attach proof that you are currently enrolled (student card, fee voucher or enrollment letter). Your university focal person checks it and approves your account."
            : "Register as the NSCT focal person for your university. Attach your appointment letter or university staff card. The NSCT super admin approves your account."}
        </p>
        <label className="f">Full name<input name="fullName" required minLength={2} /></label>
        <label className="f">University
          <select name="universityId" required value={uni} onChange={(e) => { setUni(e.target.value); setCampus(""); setDept(""); }}>
            <option value="">Select your university</option>{unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <div className="grid g2">
          <label className="f">Campus<select name="campusId" value={campus} onChange={(e) => { setCampus(e.target.value); setDept(""); }}><option value="">Select</option>{campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          {kind === "student"
            ? <label className="f">Department<select name="departmentId" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">Select</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            : <label className="f">Designation<input name="designation" required placeholder="e.g. Assistant Professor, NSCT focal person" /></label>}
        </div>
        {kind === "student" && (
          <>
            <div className="grid g2">
              <label className="f">Program<select name="program" required><option value="">Select</option>{progs.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label className="f">Roll number<input name="rollNumber" required placeholder="As on your university card" /></label>
            </div>
            <div className="grid g3">
              <label className="f">Semester<select name="semester" defaultValue="7">{["1", "2", "3", "4", "5", "6", "7", "8", "Graduated"].map((x) => <option key={x}>{x}</option>)}</select></label>
              <label className="f">Section<input name="section" placeholder="e.g. A" /></label>
              <label className="f">Gender (optional)<select name="gender"><option value="">Prefer not to answer</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></label>
            </div>
          </>
        )}
        <div className="grid g2">
          <label className="f">{kind === "student" ? "Email (optional)" : "Official university email"}<input name="email" type="email" required={kind === "focal"} /></label>
          <label className="f">Mobile number{kind === "student" ? " (optional)" : ""}<input name="phone" type="tel" required={kind === "focal"} placeholder="0300 1234567" /></label>
        </div>
        {kind === "student" && <label className="f">City (optional)<input name="city" /></label>}
        <div className="grid g2">
          <label className="f">Password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
          <label className="f">Confirm password<input name="password2" type="password" required minLength={8} autoComplete="new-password" /></label>
        </div>
        <span className="tiny muted">At least 8 characters with a letter and a number.</span>
        <label className="f">{kind === "student" ? "Proof of current enrollment" : "Appointment letter or staff card"} (JPG, PNG or PDF, up to 2 MB)
          <input name="proof" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" />
        </label>
        {kind === "student" && (
          <label className="check"><input type="checkbox" name="consent" value="yes" required /><span>I agree that my results are used for my feedback, by my university to support my preparation, and in anonymised group form only for national skills reports. <a href="/privacy">Privacy policy</a>.</span></label>
        )}
        {msg && <div className="notice bad">{msg}</div>}
        <button className="btn" type="submit" disabled={busy}>{busy ? "Submitting" : "Submit registration"}</button>
        <span className="small">Already registered? <a href="/signin">Sign in</a></span>
      </form>
    </main>
  );
}
