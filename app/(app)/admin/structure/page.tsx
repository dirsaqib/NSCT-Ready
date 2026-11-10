"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Page, Card, useApi, Loading, JsonForm, Pill } from "@/components/ui";

type Dept = { id: string; name: string; programs: string[] };
type Campus = { id: string; name: string; city: string | null; district: string | null; departments: Dept[] };
type U = { id: string; name: string; city: string | null; province: string | null; sector: string | null; campuses: Campus[]; _count: { profiles: number } };
const PROVINCES = ["Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan", "Islamabad", "Gilgit-Baltistan", "Azad Kashmir"];

/** University, campus and department hierarchy with programs. */
export default function Structure() {
  const { data, error, reload } = useApi<{ universities: U[] }>("/api/admin/structure");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const save = async (body: object) => { await api("/api/admin/structure", { body }); reload(); };
  const del = async (kind: string, id: string) => { if (window.confirm(`Delete this ${kind}? Students linked to it keep their records.`)) { await api("/api/admin/structure", { method: "DELETE", body: { kind, id } }).catch((e) => alert(e.message)); reload(); } };
  if (!data) return <Loading error={error} />;
  const list = data.universities.filter((u) => u.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Page title="Universities, campuses and departments" sub={`${data.universities.length} universities.`}>
      <div className="grid g2" style={{ marginBottom: 16 }}>
        <Card title="Add a university">
          <JsonForm submit="Add" onSubmit={(v) => save({ kind: "university", name: v.name, city: v.city || undefined, province: v.province || undefined, sector: v.sector || undefined })}>
            <label className="f">Name<input name="name" type="text" required /></label>
            <div className="grid g3">
              <label className="f">City<input name="city" type="text" /></label>
              <label className="f">Province<select name="province"><option value="">Choose</option>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</select></label>
              <label className="f">Sector<select name="sector"><option>Public</option><option>Private</option></select></label>
            </div>
          </JsonForm>
        </Card>
        <Card title="Find"><input type="text" placeholder="Search universities" value={q} onChange={(e) => setQ(e.target.value)} /></Card>
      </div>
      {list.map((u) => (
        <div className="card" key={u.id} style={{ marginBottom: 10 }}>
          <div className="row between">
            <button className="btn ghost" onClick={() => setOpen(open === u.id ? null : u.id)}><b>{u.name}</b></button>
            <span className="small muted">{u.city} · {u.province} · {u.sector} · {u._count.profiles} students · {u.campuses.length} campuses</span>
          </div>
          {open === u.id && (
            <div style={{ marginTop: 10 }}>
              {u.campuses.map((c) => (
                <div key={c.id} style={{ borderLeft: "3px solid var(--line)", paddingLeft: 12, marginBottom: 12 }}>
                  <div className="row between"><b>{c.name}</b><span className="small muted">{c.city} {c.district && `· ${c.district}`} <button className="btn ghost sm" onClick={() => del("campus", c.id)}>Delete</button></span></div>
                  {c.departments.map((d) => (
                    <div key={d.id} className="row small" style={{ margin: "4px 0" }}>
                      <span>{d.name}</span>{d.programs.map((p) => <Pill key={p} tone="grey">{p}</Pill>)}
                      <button className="btn ghost sm" onClick={async () => { const p = window.prompt("Programs, comma separated", d.programs.join(", ")); if (p != null) save({ kind: "department", id: d.id, campusId: c.id, name: d.name, programs: p.split(",").map((x) => x.trim()).filter(Boolean) }); }}>Edit programs</button>
                      <button className="btn ghost sm" onClick={() => del("department", d.id)}>Delete</button>
                    </div>
                  ))}
                  <form className="row" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); save({ kind: "department", campusId: c.id, name: String(f.get("name")), programs: String(f.get("programs") || "").split(",").map((x) => x.trim()).filter(Boolean) }); e.currentTarget.reset(); }}>
                    <input name="name" type="text" placeholder="New department" required style={{ maxWidth: 220 }} />
                    <input name="programs" type="text" placeholder="Programs, comma separated" style={{ maxWidth: 320 }} />
                    <button className="btn sm" type="submit">Add department</button>
                  </form>
                </div>
              ))}
              <form className="row" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); save({ kind: "campus", universityId: u.id, name: String(f.get("name")), city: String(f.get("city") || "") || undefined, district: String(f.get("district") || "") || undefined }); e.currentTarget.reset(); }}>
                <input name="name" type="text" placeholder="New campus" required style={{ maxWidth: 220 }} />
                <input name="city" type="text" placeholder="City" style={{ maxWidth: 140 }} />
                <input name="district" type="text" placeholder="District" style={{ maxWidth: 140 }} />
                <button className="btn sm" type="submit">Add campus</button>
              </form>
            </div>
          )}
        </div>
      ))}
    </Page>
  );
}
