"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/api";
import SnapshotView from "@/components/SnapshotView";
import type { Snapshot } from "@/lib/reports";

type Row = { id: string; createdAt: string; minGroup: number; data: Snapshot };

export default function Publish() {
  const [mg, setMg] = useState(20);
  const [preview, setPreview] = useState<Snapshot | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const load = () => {
    api<Snapshot>(`/api/reports/national?minGroup=${mg}`).then(setPreview);
    api<{ snapshots: Row[] }>("/api/reports/snapshots").then((x) => setRows(x.snapshots));
  };
  useEffect(load, [mg]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="top">
        <div><h1>HEC and government reports</h1><p className="sub">Build an anonymised snapshot and publish it to the HEC panel. HEC never sees student records.</p></div>
        <div className="row">
          <label className="small"><b>Minimum group</b> <select value={mg} onChange={(e) => setMg(Number(e.target.value))} style={{ width: "auto" }}>{[5, 10, 20, 30].map((v) => <option key={v}>{v}</option>)}</select></label>
          <button className="btn acc" onClick={async () => {
            if (!window.confirm("Publish this anonymised report to the HEC panel?")) return;
            await api("/api/reports/snapshots", { body: { minGroup: mg } });
            load();
          }}>Publish to HEC panel</button>
        </div>
      </div>
      {mg < 20 && <div className="notice" style={{ marginBottom: 16 }}>A minimum group below 20 is for pilot testing only.</div>}
      <div className="card" style={{ marginBottom: 16 }}><h2>Published reports</h2>
        {rows.length ? <table><tbody>
          <tr><th>Published</th><th>Students</th><th>Avg readiness</th><th>Min group</th><th /></tr>
          {rows.map((r) => <tr key={r.id}><td>{new Date(r.createdAt).toLocaleString("en-GB")}</td><td>{r.data.students}</td><td>{r.data.avgReadiness ?? "n/a"}</td><td>{r.minGroup}</td>
            <td><button className="btn ghost sm" onClick={async () => { if (window.confirm("Withdraw this report?")) { await api(`/api/reports/snapshots/${r.id}`, { method: "DELETE" }); load(); } }}>Withdraw</button></td></tr>)}
        </tbody></table> : <div className="empty">Nothing published yet.</div>}
      </div>
      <h2>Preview of what HEC will see</h2>
      {preview ? <SnapshotView s={preview} /> : <div className="spin" />}
    </>
  );
}
