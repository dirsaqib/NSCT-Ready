"use client";
import { useState } from "react";
import { Page, Card, Stat, useApi, Loading, Table } from "@/components/ui";

type Lvl = { level: string; id?: string; name?: string; label: string };
type D = { level: string; registered: number; active: number; avgReadiness: number | null; next: string; rows: { id: string; name: string; registered: number; active: number; avgReadiness: number | null }[] };

/** National, then province, university, campus, department, students. */
export default function Drilldown() {
  const [path, setPath] = useState<Lvl[]>([{ level: "national", label: "Pakistan" }]);
  const cur = path[path.length - 1];
  const qs = new URLSearchParams({ level: cur.level, ...(cur.id ? { id: cur.id } : {}), ...(cur.name ? { name: cur.name } : {}) }).toString();
  const { data: d, error } = useApi<D>(`/api/admin/drilldown?${qs}`, [qs]);
  return (
    <Page title="Drill down" sub="Click any row to go one level deeper.">
      <div className="row" style={{ marginBottom: 12 }}>
        {path.map((p, i) => <span key={i}>{i > 0 && " › "}<button className="btn ghost sm" onClick={() => setPath(path.slice(0, i + 1))}>{p.label}</button></span>)}
      </div>
      {!d ? <Loading error={error} /> : (
        <>
          <div className="grid g3" style={{ marginBottom: 16 }}>
            <Stat k="Registered" v={d.registered} /><Stat k="Active" v={d.active} /><Stat k="Avg readiness" v={d.avgReadiness ?? "n/a"} />
          </div>
          <Card title={d.next === "student" ? "Students" : `By ${d.next}`}>
            <Table rows={d.rows} onRow={d.next === "student" ? undefined : (r) => setPath([...path, d.next === "province" ? { level: "province", name: r.id, label: r.name } : { level: d.next, id: r.id, label: r.name }])}
              cols={[["Name", (r) => <b>{r.name}</b>], ["Registered", (r) => r.registered], ["Active", (r) => r.active], ["Avg readiness", (r) => r.avgReadiness ?? "n/a"]]} />
          </Card>
        </>
      )}
    </Page>
  );
}
