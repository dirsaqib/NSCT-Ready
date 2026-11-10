"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { SUBJECTS } from "@/lib/syllabus";
import { Page, Card, useApi, Loading, Table, JsonForm, fmtDateTime } from "@/components/ui";

type B = { id: string | null; key: string; name: string; counts: Record<string, number>; difficulty: Record<string, number> | null; durationMin: number; passMark: number; negativeMarking: number };
type W = { id: string; name: string; blueprintKey: string; opensAt: string; closesAt: string; universityId: string | null };

/** Blueprints (subject counts, difficulty mix, time, pass mark, negative marking) and national test windows. */
export default function Tests() {
  const bp = useApi<{ blueprints: B[] }>("/api/admin/blueprints");
  const win = useApi<{ windows: W[] }>("/api/admin/windows");
  const [edit, setEdit] = useState<B | null>(null);
  const total = edit ? Object.values(edit.counts).reduce((s, x) => s + Number(x || 0), 0) : 0;
  return (
    <Page title="Tests and schedule" sub="Change test structure without code. Schedule national mock windows.">
      <Card title="Blueprints" style={{ marginBottom: 16 }}>
        {!bp.data ? <Loading error={bp.error} /> : (
          <Table rows={bp.data.blueprints} cols={[
            ["Test", (b) => <b>{b.name}</b>], ["Questions", (b) => Object.values(b.counts).reduce((s, x) => s + x, 0)], ["Minutes", (b) => b.durationMin],
            ["Pass mark", (b) => `${b.passMark}%`], ["Negative marking", (b) => (b.negativeMarking ? `${b.negativeMarking} per wrong` : "None")],
            ["", (b) => <button className="btn sm sec" onClick={() => setEdit({ ...b, difficulty: b.difficulty ?? { 1: 30, 2: 50, 3: 20 } })}>Edit</button>],
          ]} />
        )}
        {edit && (
          <form style={{ marginTop: 16 }} onSubmit={async (e) => {
            e.preventDefault();
            await api("/api/admin/blueprints", { method: "PUT", body: { key: edit.key, name: edit.name, counts: Object.fromEntries(Object.entries(edit.counts).map(([k, v]) => [k, Number(v)])), difficulty: Object.fromEntries(Object.entries(edit.difficulty!).map(([k, v]) => [k, Number(v)])), durationMin: Number(edit.durationMin), passMark: Number(edit.passMark), negativeMarking: Number(edit.negativeMarking) } }).then(() => { setEdit(null); bp.reload(); }).catch((er) => alert(er.message));
          }}>
            <h3>{edit.name} <span className="muted small">({total} questions)</span></h3>
            <div className="grid g5">{SUBJECTS.map((s) => <label key={s.key} className="f">{s.short}<input type="number" min={0} max={100} value={edit.counts[s.key] ?? 0} onChange={(e) => setEdit({ ...edit, counts: { ...edit.counts, [s.key]: Number(e.target.value) } })} /></label>)}</div>
            <div className="grid g4" style={{ marginTop: 8 }}>
              {(["1", "2", "3"] as const).map((k) => <label key={k} className="f">{["Easy", "Medium", "Hard"][Number(k) - 1]} %<input type="number" min={0} max={100} value={edit.difficulty![k] ?? 0} onChange={(e) => setEdit({ ...edit, difficulty: { ...edit.difficulty!, [k]: Number(e.target.value) } })} /></label>)}
              <label className="f">Minutes<input type="number" min={5} max={300} value={edit.durationMin} onChange={(e) => setEdit({ ...edit, durationMin: Number(e.target.value) })} /></label>
              <label className="f">Pass mark %<input type="number" min={0} max={100} value={edit.passMark} onChange={(e) => setEdit({ ...edit, passMark: Number(e.target.value) })} /></label>
              <label className="f">Negative marking (0 to 1)<input type="number" step="0.05" min={0} max={1} value={edit.negativeMarking} onChange={(e) => setEdit({ ...edit, negativeMarking: Number(e.target.value) })} /></label>
            </div>
            <div className="row" style={{ marginTop: 12 }}><button className="btn" type="submit">Save blueprint</button><button className="btn sec" type="button" onClick={() => setEdit(null)}>Cancel</button></div>
          </form>
        )}
      </Card>
      <div className="grid g2">
        <Card title="Schedule a national mock window">
          <JsonForm submit="Schedule" onSubmit={async (v) => {
            await api("/api/admin/windows", { body: { name: v.name, blueprintKey: v.blueprintKey, opensAt: new Date(v.opensAt).toISOString(), closesAt: new Date(v.closesAt).toISOString(), announce: !!v.announce } });
            win.reload();
          }}>
            <label className="f">Name<input name="name" type="text" required placeholder="National mock 2" /></label>
            <label className="f">Blueprint<select name="blueprintKey">{bp.data?.blueprints.map((b) => <option key={b.key} value={b.key}>{b.name}</option>)}</select></label>
            <div className="grid g2"><label className="f">Opens<input name="opensAt" type="datetime-local" required /></label><label className="f">Closes<input name="closesAt" type="datetime-local" required /></label></div>
            <label className="check"><input type="checkbox" name="announce" value="1" defaultChecked /><span>Announce to all students with reminders</span></label>
          </JsonForm>
        </Card>
        <Card title="Windows">
          {!win.data ? <Loading error={win.error} /> : <Table rows={win.data.windows} empty="No windows scheduled." cols={[["Name", (w) => <b>{w.name}</b>], ["Opens", (w) => fmtDateTime(w.opensAt)], ["Closes", (w) => fmtDateTime(w.closesAt)], ["", (w) => <button className="btn ghost sm" onClick={async () => { if (window.confirm("Cancel this window?")) { await api("/api/admin/windows", { method: "DELETE", body: { id: w.id } }); win.reload(); } }}>Cancel</button>]]} />}
        </Card>
      </div>
    </Page>
  );
}
