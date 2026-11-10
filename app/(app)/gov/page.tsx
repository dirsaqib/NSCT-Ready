"use client";
import Link from "next/link";
import { useState } from "react";
import { SUBJECT_SHORT } from "@/components/api";
import { Page, Card, Stat, useApi, Loading, Table, Tabs } from "@/components/ui";
import { HBars } from "@/components/Charts";

type G = { rows: { group: string; students: number; active: number; avgReadiness: number | null }[]; hidden: number };
type D = {
  withheld: boolean; minGroup: number; students: number | string; active?: number; universities?: number; tests?: number; avgScore?: number; avgReadiness?: number | null;
  subjects?: { key: string; name: string; weight: number; accuracy: number | null }[];
  skillGaps?: { subject: string; topic: string; accuracy: number }[];
  byProvince?: G; byDistrict?: G; byCity?: G; bySector?: G; byUniversity?: G; byProgram?: G; byGender?: G;
};
type Key = "byProvince" | "byDistrict" | "byCity" | "bySector" | "byUniversity" | "byProgram" | "byGender";

// Rough tile layout of Pakistan's provinces and territories (column, row).
const TILES: [string, number, number][] = [["Gilgit-Baltistan", 2, 0], ["Azad Kashmir", 3, 1], ["Khyber Pakhtunkhwa", 1, 1], ["Islamabad", 2, 1], ["Punjab", 2, 2], ["Balochistan", 0, 3], ["Sindh", 1, 3]];
const shade = (v: number | null | undefined) => (v == null ? "#EEF1EF" : v >= 65 ? "#0B6E4F" : v >= 55 ? "#3E9A78" : v >= 45 ? "#8CC5AE" : "#D5EADF");

/** HEC and government: live anonymised national view with filters. Groups below the minimum size are withheld. */
export default function Gov() {
  const [f, setF] = useState<Record<string, string>>({});
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { data: d, error } = useApi<D>(`/api/gov/dashboard?${qs}`, [qs]);
  const [by, setBy] = useState<Key>("byProvince");
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  return (
    <Page title="National skills dashboard" sub="Anonymised and live. Only students who consented to research are counted."
      actions={<Link className="btn sec" href="/gov/archive">Published reports</Link>}>
      <Card style={{ marginBottom: 16 }}>
        <div className="grid g4">
          <label className="f">Province<select value={f.province ?? ""} onChange={(e) => set("province", e.target.value)}><option value="">All</option>{TILES.map((t) => <option key={t[0]}>{t[0]}</option>)}</select></label>
          <label className="f">Sector<select value={f.sector ?? ""} onChange={(e) => set("sector", e.target.value)}><option value="">All</option><option>Public</option><option>Private</option></select></label>
          <label className="f">City<input type="text" value={f.city ?? ""} onChange={(e) => set("city", e.target.value)} placeholder="Any" /></label>
          <label className="f">Program<input type="text" value={f.program ?? ""} onChange={(e) => set("program", e.target.value)} placeholder="Any, e.g. BS Computer Science" /></label>
          <label className="f">Gender<select value={f.gender ?? ""} onChange={(e) => set("gender", e.target.value)}><option value="">All</option><option>Female</option><option>Male</option></select></label>
        </div>
      </Card>
      {!d ? <Loading error={error} /> : d.withheld ? (
        <div className="notice">This selection has {d.students} students. Results are shown only for groups of {d.minGroup} or more, to protect privacy. Widen the filters.</div>
      ) : (
        <>
          <div className="grid g4" style={{ marginBottom: 16 }}>
            <Stat k="Students" v={Number(d.students).toLocaleString()} d={`${d.active} active, ${d.universities} universities`} />
            <Stat k="Tests taken" v={d.tests!.toLocaleString()} d={`average score ${d.avgScore}%`} />
            <Stat k="Average readiness" v={d.avgReadiness ?? "n/a"} d="active students, out of 100" />
            <Stat k="Minimum group" v={d.minGroup} d="smaller groups are withheld" />
          </div>
          <div className="grid g2" style={{ marginBottom: 16 }}>
            <Card title="Readiness by province">
              <svg viewBox="0 0 440 340" width="100%" role="img" aria-label="Province heatmap">
                {TILES.map(([name, c, r]) => {
                  const row = d.byProvince!.rows.find((x) => x.group === name);
                  return (
                    <g key={name} transform={`translate(${c * 108 + 4},${r * 82 + 4})`} style={{ cursor: "pointer" }} onClick={() => set("province", f.province === name ? "" : name)}>
                      <title>{`${name}: ${row ? `${row.avgReadiness ?? "n/a"} readiness, ${row.students} students` : "withheld or no data"}`}</title>
                      <rect width="100" height="74" rx="8" fill={shade(row?.avgReadiness)} stroke={f.province === name ? "#111" : "#fff"} strokeWidth="2" />
                      <text x="50" y="32" textAnchor="middle" fontSize="11" fill={(row?.avgReadiness ?? 0) >= 55 ? "#fff" : "#1B2420"}>{name.replace("Khyber Pakhtunkhwa", "KP").replace("Gilgit-Baltistan", "GB").replace("Azad Kashmir", "AJK")}</text>
                      <text x="50" y="52" textAnchor="middle" fontSize="16" fontWeight="700" fill={(row?.avgReadiness ?? 0) >= 55 ? "#fff" : "#1B2420"}>{row?.avgReadiness ?? "–"}</text>
                    </g>
                  );
                })}
              </svg>
              <p className="tiny muted">Click a province to filter. Darker means higher average readiness.</p>
            </Card>
            <Card title="Subject accuracy">
              <HBars grade rows={d.subjects!.map((s) => ({ label: s.name, sub: `${s.weight}% of test`, v: s.accuracy ?? 0, text: s.accuracy == null ? "n/a" : `${s.accuracy}%` }))} max={100} />
            </Card>
          </div>
          <Card style={{ marginBottom: 16 }}>
            <Tabs value={by} onChange={setBy} tabs={[["byProvince", "Province"], ["byDistrict", "District"], ["byCity", "City"], ["bySector", "Public and private"], ["byUniversity", "University"], ["byProgram", "Program"], ["byGender", "Gender"]]} />
            <Table rows={d[by]!.rows} cols={[["Group", (r) => r.group], ["Students", (r) => r.students], ["Active", (r) => r.active], ["Avg readiness", (r) => <b>{r.avgReadiness ?? "n/a"}</b>]]} />
            {d[by]!.hidden > 0 && <p className="tiny muted">{d[by]!.hidden} groups withheld because they have fewer than {d.minGroup} students.</p>}
          </Card>
          <Card title="National skill gaps (weakest topics)">
            <Table rows={d.skillGaps!} cols={[["Subject", (t) => SUBJECT_SHORT[t.subject]], ["Topic", (t) => t.topic], ["Accuracy", (t) => <b>{t.accuracy}%</b>]]} />
            <p className="small muted">Useful for curriculum policy, faculty training and funding decisions.</p>
          </Card>
        </>
      )}
    </Page>
  );
}
