"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Page, Card, useApi, Loading, Table, Pill, fmtDateTime } from "@/components/ui";

type Row = { id: string; filename: string | null; createdAt: string; undoneAt: string | null; updated: number; created: number; stillThere: number; university: string; uploader: string };
type D = { total: number; page: number; universities: { id: string; name: string; uploads: number }[]; rows: Row[] };

/** Every student upload on the platform, with the option to delete the students a wrong upload created. */
export default function Uploads() {
  const [uni, setUni] = useState("");
  const [page, setPage] = useState(0);
  const { data, error, reload } = useApi<D>(`/api/admin/uploads?universityId=${uni}&page=${page}`, [uni, page]);
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  async function del(r: Row) {
    setBusy(true);
    try { const x = await api<{ removed: number }>("/api/admin/uploads", { method: "POST", body: { batchId: r.id } }); setMsg(`Deleted ${x.removed} students from that upload, with their tests and progress.`); setConfirm(null); reload(); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Page title="Student uploads" sub="Every Excel upload by every focal person, old and new. Deleting an upload removes the students it created.">
      {msg && <div className="notice info" style={{ marginBottom: 12 }}>{msg}</div>}
      {confirm && (
        <div className="card" style={{ borderColor: "var(--bad)", marginBottom: 16 }}>
          <b>Delete {confirm.stillThere} students from this upload?</b>
          <p className="small" style={{ margin: "6px 0 12px" }}>{confirm.university} · {confirm.filename ?? "Excel file"} · uploaded {fmtDateTime(confirm.createdAt)} by {confirm.uploader}. Their accounts, tests and progress are deleted permanently and cannot be recovered. Students this upload only updated are not touched.</p>
          <div className="row"><button className="btn" style={{ background: "var(--bad)" }} disabled={busy} onClick={() => del(confirm)}>{busy ? "Deleting…" : "Yes, delete permanently"}</button><button className="btn sec" onClick={() => setConfirm(null)}>Cancel</button></div>
        </div>
      )}
      {!data ? <Loading error={error} /> : (
        <Card right={<select value={uni} onChange={(e) => { setUni(e.target.value); setPage(0); }}><option value="">All universities ({data.universities.reduce((t, u) => t + u.uploads, 0)})</option>{data.universities.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.uploads})</option>)}</select>}>
          <Table rows={data.rows} empty="No uploads yet." cols={[
            ["When", (r) => fmtDateTime(r.createdAt)], ["University", (r) => r.university], ["By", (r) => r.uploader],
            ["File", (r) => <>{r.filename ?? "Excel file"}{r.filename?.includes("recovered") && <div className="tiny muted">rebuilt from the activity log</div>}</>],
            ["Added", (r) => r.created], ["Still on platform", (r) => r.stillThere], ["Updated", (r) => r.updated],
            ["", (r) => r.undoneAt && !r.stillThere ? <Pill tone="grey">Deleted</Pill> : r.stillThere ? <button className="btn sm sec" style={{ color: "var(--bad)" }} onClick={() => setConfirm(r)}>Delete students</button> : <span className="tiny muted">–</span>],
          ]} />
          <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
            <span className="small muted">{data.total} uploads</span>
            <span className="row"><button className="btn sm sec" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</button><button className="btn sm sec" disabled={(page + 1) * 100 >= data.total} onClick={() => setPage(page + 1)}>Older</button></span>
          </div>
        </Card>
      )}
    </Page>
  );
}
