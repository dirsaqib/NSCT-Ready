"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/components/api";

type Row = { id: string; createdAt: string; minGroup: number; data: { students: number; active: number; avgReadiness: number | null } };

export default function Archive() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { api<{ snapshots: Row[] }>("/api/reports/snapshots").then((x) => setRows(x.snapshots)); }, []);
  if (!rows) return <div className="spin" />;
  return (
    <>
      <div className="top"><div><h1>Report archive</h1><p className="sub">Every published national report.</p></div></div>
      <div className="card">
        {rows.length ? <table><tbody>
          <tr><th>Published</th><th>Students</th><th>Active</th><th>Avg readiness</th><th>Min group</th><th /></tr>
          {rows.map((r) => <tr key={r.id}><td>{new Date(r.createdAt).toLocaleString("en-GB")}</td><td>{r.data.students}</td><td>{r.data.active}</td><td><b>{r.data.avgReadiness ?? "n/a"}</b></td><td>{r.minGroup}</td><td><Link className="btn sm sec" href={`/gov?id=${r.id}`}>Open</Link></td></tr>)}
        </tbody></table> : <div className="empty">Nothing published yet.</div>}
      </div>
    </>
  );
}
