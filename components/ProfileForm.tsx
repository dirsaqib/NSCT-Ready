"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

const PROGRAMS = ["BS Computer Science", "BS Software Engineering", "BS Information Technology", "BS Artificial Intelligence", "BS Data Science", "BS Cyber Security", "BS Computer Games Development", "BS Bioinformatics", "Other computing program"];
type Campus = { id: string; name: string; departments: { id: string; name: string; programs: string[] }[] };
type P = {
  fullName: string; universityId: string; campusId: string; departmentId: string; program: string; semester: string; section: string; rollNumber: string;
  city: string; alias: string; gender: string; screenReader: boolean; consentResearch: boolean; leaderboard: boolean; talentPool: boolean;
};

export default function ProfileForm({ after }: { after: string }) {
  const r = useRouter();
  const [unis, setUnis] = useState<{ id: string; name: string }[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [p, setP] = useState<P>({ fullName: "", universityId: "", campusId: "", departmentId: "", program: "", semester: "7", section: "", rollNumber: "", city: "", alias: "", gender: "", screenReader: false, consentResearch: true, leaderboard: false, talentPool: false });
  const [status, setStatus] = useState<string | null>(null);
  const [reject, setReject] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<{ universities: { id: string; name: string }[] }>("/api/universities").then((x) => setUnis(x.universities));
    api<{ profile: (Partial<P> & { rejectReason?: string | null }) | null; account: { status: string } }>("/api/profile").then((x) => {
      setStatus(x.account?.status ?? null);
      if (x.profile) {
        const pr = x.profile;
        setReject(pr.rejectReason ?? null);
        setP((old) => ({ ...old, ...Object.fromEntries(Object.entries(pr).filter(([, v]) => v != null)) } as P));
      }
    });
  }, []);
  useEffect(() => {
    if (!p.universityId) return setCampuses([]);
    api<{ campuses: Campus[] }>(`/api/universities/${p.universityId}/structure`).then((x) => setCampuses(x.campuses));
  }, [p.universityId]);

  const set = (k: keyof P) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setP({ ...p, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });
  const depts = campuses.find((c) => c.id === p.campusId)?.departments ?? [];
  const programs = depts.find((d) => d.id === p.departmentId)?.programs?.length ? depts.find((d) => d.id === p.departmentId)!.programs : PROGRAMS;

  return (
    <form className="card grid" style={{ gap: 14 }} onSubmit={async (e) => {
      e.preventDefault();
      try {
        await api("/api/profile", { method: "PUT", body: { ...p, campusId: p.campusId || null, departmentId: p.departmentId || null, gender: p.gender || undefined, section: p.section || undefined } });
        r.push(after);
      } catch (er) { setMsg((er as Error).message); }
    }}>
      {status && (
        <div className={`notice ${status === "PENDING" ? "" : "info"}`}>
          Account status: <b>{status === "PENDING" ? "Waiting for verification by your university" : status === "VERIFIED" ? "Verified" : status === "ACTIVE" ? "Active" : status}</b>
          {reject && <div className="small" style={{ color: "var(--bad)" }}>Your university asked you to check your details: {reject}</div>}
        </div>
      )}
      <label className="f">Full name<input type="text" required value={p.fullName} onChange={set("fullName")} /></label>
      <label className="f">University
        <select required value={p.universityId} onChange={(e) => setP({ ...p, universityId: e.target.value, campusId: "", departmentId: "" })}>
          <option value="">Select your university</option>{unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </label>
      <div className="grid g2">
        <label className="f">Campus<select value={p.campusId} onChange={(e) => setP({ ...p, campusId: e.target.value, departmentId: "" })}><option value="">Select</option>{campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="f">Department<select value={p.departmentId} onChange={set("departmentId")}><option value="">Select</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      </div>
      <div className="grid g2">
        <label className="f">Program<select required value={p.program} onChange={set("program")}><option value="">Select</option>{programs.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="f">Roll number<input type="text" required value={p.rollNumber} onChange={set("rollNumber")} placeholder="As on your university card" /></label>
      </div>
      <div className="grid g3">
        <label className="f">Semester<select value={p.semester} onChange={set("semester")}>{["5", "6", "7", "8", "Graduated"].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="f">Section<input type="text" value={p.section} onChange={set("section")} placeholder="e.g. A" /></label>
        <label className="f">Gender (optional)<select value={p.gender} onChange={set("gender")}><option value="">Prefer not to answer</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></label>
      </div>
      <div className="grid g2">
        <label className="f">City<input type="text" value={p.city} onChange={set("city")} /></label>
        <label className="f">Leaderboard nickname<input type="text" value={p.alias} onChange={set("alias")} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={p.screenReader} onChange={set("screenReader")} /><span>I use a screen reader (tests will use simpler layouts). For extra time, ask your university focal person.</span></label>
      <label className="check"><input type="checkbox" required checked={p.consentResearch} onChange={set("consentResearch")} /><span>I agree that my results are used for my feedback, by my university to support my preparation, and in anonymised group form only (never my name or contact details, no group under 20 students) for national skills reports. <a href="/privacy">Privacy policy</a>.</span></label>
      <label className="check"><input type="checkbox" checked={p.leaderboard} onChange={set("leaderboard")} /><span>Show my nickname and best mock score on the leaderboard (optional).</span></label>
      <label className="check"><input type="checkbox" checked={p.talentPool} onChange={set("talentPool")} /><span>Let verified employers see my scores and contact me through the platform (optional, you can leave anytime). Your phone and email are never shown.</span></label>
      {msg && <div className="notice bad">{msg}</div>}
      <button className="btn" type="submit">Save</button>
    </form>
  );
}
