"use client";
import { useEffect, useMemo, useState } from "react";
import SearchSelect from "./SearchSelect";
import { AKA } from "./universityAka";

// Bachelor computing programs under NCEAC (National Computing Education Accreditation Council).
const PROGRAMS = ["BS Artificial Intelligence", "BS Bioinformatics", "BS Computer Science", "BS Computer Engineering", "BS Cyber Security", "BS Data Science", "BS Information Systems", "BS Information Technology", "BS Multimedia and Gaming (Computer Games Development)", "BS Software Engineering"];
// Common names of computing departments in Pakistani universities, offered as suggestions.
const COMMON_DEPTS = ["Computer Science", "Software Engineering", "Information Technology", "Computer Science and Information Technology", "Computing", "Artificial Intelligence", "Data Science", "Artificial Intelligence and Data Science", "Cyber Security", "Computer Engineering", "Information Systems", "Bioinformatics", "Computer Games Development", "Creative Technologies", "Electrical and Computer Engineering"];
type Campus = { id: string; name: string; departments: { id: string; name: string; programs: string[] }[] };

const OTHER = "__other__";
const Req = () => <span style={{ color: "var(--bad, #C2453A)" }}> *</span>;
const fmtCnic = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 13);
  return d.length > 12 ? `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}` : d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

/** Public registration form. Students attach proof of being a student, focal persons attach an appointment letter. */
export default function SignupForm({ kind }: { kind: "student" | "focal" }) {
  const [unis, setUnis] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [uni, setUni] = useState("");
  const [uniText, setUniText] = useState("");
  const [program, setProgram] = useState("");
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [dept, setDept] = useState("");
  const [semester, setSemester] = useState("");
  const [cnic, setCnic] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch("/api/universities").then((r) => r.json()).then((x) => setUnis(x.universities ?? [])).catch(() => {}); }, []);
  useEffect(() => {
    setCampuses([]);
    if (uni) fetch(`/api/universities/${uni}/structure`).then((r) => r.json()).then((x) => setCampuses(x.campuses ?? [])).catch(() => {});
  }, [uni]);

  // The university's own departments first, then common names. The student can also type their own.
  const deptOptions = useMemo(() => {
    const own = [...new Set(campuses.flatMap((c) => c.departments.map((d) => d.name)))].sort();
    const rest = COMMON_DEPTS.filter((n) => !own.some((o) => o.toLowerCase() === n.toLowerCase()));
    return [...own.map((n) => ({ id: n, name: n, hint: "your university" })), ...rest.map((n) => ({ id: n, name: n }))];
  }, [campuses]);
  const graduated = semester === "Graduated";

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!uni && uniText.trim().length < 3) return setMsg("Enter your university.");
    if (kind === "student" && !dept.trim()) return setMsg("Enter your department.");
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
            ? "Fill in your details and attach proof that you study, or have graduated, at your university. Your university focal person checks it and approves your account."
            : "Register as the NSCT focal person for your university. Attach your appointment letter or university staff card. The NSCT Ready super admin approves your account."}
        </p>
        <p className="tiny muted" style={{ margin: 0 }}>Fields marked <Req /> are required.</p>
        <label className="f"><span>Full name<Req /></span><input name="fullName" required minLength={2} placeholder="As on your CNIC" /></label>
        <label className="f"><span>University<Req /></span>
          <SearchSelect name="universityId" textName="universityName" options={unis.map((u) => ({ id: u.id, name: u.name, hint: u.city ?? undefined, keywords: AKA[u.name] }))} value={uni} onChange={(id) => { setUni(id); setDept(""); }} onText={setUniText} allowFree placeholder="Type to search all universities in Pakistan" required />
          {!uni && uniText.trim().length > 2 && <span className="tiny muted">Not in the list? Keep it as typed. We will add your university after checking.</span>}
        </label>
        {kind === "student" ? (
          <>
            <div className="grid g2">
              <label className="f"><span>Department<Req /></span>
                <SearchSelect key={uni} textName="departmentName" options={deptOptions} value={deptOptions.some((d) => d.id === dept) ? dept : ""} onChange={(id) => id && setDept(id)} onText={setDept} allowFree placeholder="Search or type your department" required />
              </label>
              <label className="f"><span>Campus (optional)</span><input name="campusName" placeholder="e.g. Islamabad, Main campus" /></label>
            </div>
            <label className="f"><span>Program<Req /></span>
              <select required value={program} onChange={(e) => setProgram(e.target.value)} name={program === OTHER ? undefined : "program"}>
                <option value="" disabled>Select your program</option>
                {PROGRAMS.map((x) => <option key={x}>{x}</option>)}
                <option value={OTHER}>Other computing program</option>
              </select>
              {program === OTHER && <input name="program" required placeholder="Type your program name" style={{ marginTop: 6 }} />}
            </label>
            <div className="grid g2">
              <label className="f"><span>{graduated ? "Roll or registration number" : "Roll number"}<Req /></span><input name="rollNumber" required placeholder={graduated ? "As on your degree or transcript" : "As on your student card"} /></label>
              <label className="f"><span>Semester<Req /></span><select name="semester" required value={semester} onChange={(e) => setSemester(e.target.value)}><option value="" disabled>Select</option>{["1", "2", "3", "4", "5", "6", "7", "8"].map((x) => <option key={x}>{x}</option>)}<option value="Graduated">Graduated</option></select></label>
            </div>
            <div className="grid g2">
              <label className="f"><span>Section (optional)</span><input name="section" placeholder="e.g. A" /></label>
              <label className="f"><span>Gender<Req /></span><select name="gender" required defaultValue=""><option value="" disabled>Select</option><option>Male</option><option>Female</option></select></label>
            </div>
            <label className="f"><span>CNIC or B-Form number<Req /></span>
              <input name="cnic" required inputMode="numeric" value={cnic} onChange={(e) => setCnic(fmtCnic(e.target.value))} pattern="\d{5}-\d{7}-\d" title="13 digits, like 12345-1234567-1" placeholder="12345-1234567-1" />
              <span className="tiny muted">Kept encrypted. Used only to stop duplicate accounts and to confirm your identity if you ask for help. Never shown to other students.</span>
            </label>
          </>
        ) : (
          <label className="f"><span>Designation<Req /></span><input name="designation" required placeholder="e.g. Assistant Professor, NSCT focal person" /></label>
        )}
        <div className="grid g2">
          <label className="f"><span>{kind === "student" ? "Email" : "Official university email"}<Req /></span><input name="email" type="email" required placeholder="you@example.com" /></label>
          <label className="f"><span>Mobile number<Req /></span><input name="phone" type="tel" required pattern="(\+92|0)3\d{2}[ -]?\d{7}" title="Pakistani mobile number, like 03001234567" placeholder="03001234567" /></label>
        </div>
        {kind === "student" && <label className="f"><span>City (optional)</span><input name="city" /></label>}
        <div className="grid g2">
          <label className="f"><span>Password<Req /></span><input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
          <label className="f"><span>Confirm password<Req /></span><input name="password2" type="password" required minLength={8} autoComplete="new-password" /></label>
        </div>
        <span className="tiny muted">At least 8 characters with a letter and a number.</span>
        {kind === "focal" ? (
          <label className="f"><span>Appointment letter or university staff card<Req /></span>
            <input name="proof" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" />
            <span className="tiny muted">One clear photo or scan. JPG, PNG or PDF, up to 2 MB.</span>
          </label>
        ) : (
          <label className="f"><span>{graduated ? "Proof of graduation" : semester ? "Proof of current enrollment" : "Proof of enrollment or graduation"}<Req /></span>
            <input name="proof" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" />
            <span className="tiny muted" style={{ lineHeight: 1.6 }}>
              {(!semester || !graduated) && <><b>Current students:</b> university student ID card (front side), paid fee challan of the current semester, or an enrollment letter from the university.<br /></>}
              {(!semester || graduated) && <><b>Graduates:</b> degree, final transcript, provisional or degree completion certificate, or a clearance letter from the university.<br /></>}
              Upload <b>one</b> clear photo or scan in which your <b>name</b>, <b>university</b> and <b>roll or registration number</b> are readable. JPG, PNG or PDF, up to 2 MB. You may cover your photo or CNIC number on it if you wish.
            </span>
          </label>
        )}
        <label className="check"><input type="checkbox" name="consent" value="yes" required />
          <span>I have read and agree to the <a href="/privacy" target="_blank">privacy policy</a> and <a href="/terms" target="_blank">terms of use</a>. {kind === "student" ? "I agree that my university can see my results to support my preparation." : "I confirm I am authorised by my university to act as its focal person."}<Req /></span>
        </label>
        {msg && <div className="notice bad">{msg}</div>}
        <button className="btn" type="submit" disabled={busy}>{busy ? "Submitting" : "Submit registration"}</button>
        <span className="small">Already registered? <a href="/signin">Sign in</a></span>
      </form>
    </main>
  );
}
