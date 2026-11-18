"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Page, Card, useApi, Loading, Table } from "@/components/ui";

type D = { id: string; name: string; programs: string[]; _count: { profiles: number } };
type Data = { departments: D[]; unlisted: { name: string; students: number }[] };

/**
 * Focal person: the university's own departments and programs. Students pick from this list at registration.
 * Departments students typed that are not on the list appear here to add with one click.
 */
export default function Departments() {
  const { data, error, reload } = useApi<Data>("/api/university/departments");
  const [edit, setEdit] = useState<{ id?: string; name: string; programs: string } | null>(null);
  const [msg, setMsg] = useState("");
  const send = async (body: object, done?: string) => {
    try {
      const r = await api<{ linked?: number }>("/api/university/departments", { body });
      setMsg(`${done ?? "Saved."}${r.linked ? ` ${r.linked} student${r.linked > 1 ? "s" : ""} linked to it.` : ""}`);
      setEdit(null); reload();
    } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <Page title="Departments and programs" sub="Your university's own list. Students choose from it when they register, so keep it complete and spelled the way your university uses it."
      actions={<button className="btn" onClick={() => setEdit({ name: "", programs: "" })}>Add department</button>}>
      {msg && <div className="notice info" style={{ marginBottom: 12 }}>{msg}</div>}
      {edit && (
        <Card title={edit.id ? "Edit department" : "New department"} style={{ marginBottom: 16, borderColor: "var(--brand)" }}>
          <form className="grid" style={{ gap: 10 }} onSubmit={(e) => { e.preventDefault(); send({ action: "save", id: edit.id, name: edit.name, programs: edit.programs.split("\n").map((x) => x.trim()).filter(Boolean) }); }}>
            <label className="f">Department name<input required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Department of Computer Science" /></label>
            <label className="f">Programs, one per line<textarea rows={4} value={edit.programs} onChange={(e) => setEdit({ ...edit, programs: e.target.value })} placeholder={"BS Computer Science\nBS Information Technology"} /></label>
            <div className="row"><button className="btn" type="submit">Save</button><button className="btn ghost" type="button" onClick={() => setEdit(null)}>Cancel</button></div>
          </form>
        </Card>
      )}
      {!data ? <Loading error={error} /> : (
        <>
          {data.unlisted.length > 0 && (
            <Card title="Typed by students, not on your list" style={{ marginBottom: 16 }}>
              <p className="small muted" style={{ marginTop: 0 }}>These students typed a department that is not on your list. Add it as it is, or merge it into an existing department so the students are grouped correctly in reports.</p>
              <Table rows={data.unlisted} cols={[
                ["Typed name", (t) => <b>{t.name}</b>],
                ["Students", (t) => t.students],
                ["", (t) => (
                  <div className="row">
                    <button className="btn sm" onClick={() => send({ action: "adopt", name: t.name }, `Added "${t.name}".`)}>Add to list</button>
                    {data.departments.length > 0 && (
                      <select defaultValue="" style={{ width: "auto" }} onChange={(e) => { const d = data.departments.find((x) => x.id === e.target.value); if (d && window.confirm(`Move students who typed "${t.name}" into ${d.name}?`)) send({ action: "save", id: d.id, name: d.name, programs: d.programs, mergeFrom: t.name }, `Merged into ${d.name}.`); }}>
                        <option value="" disabled>Merge into...</option>{data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    )}
                  </div>
                )],
              ]} />
            </Card>
          )}
          <Card title={`${data.departments.length} departments`}>
            <Table rows={data.departments} empty="No departments yet. Add your computing departments so students can pick them when they register." cols={[
              ["Department", (d) => <b>{d.name}</b>],
              ["Programs", (d) => <span className="small">{d.programs.join(", ") || <span className="muted">None added</span>}</span>],
              ["Students", (d) => d._count.profiles],
              ["", (d) => (
                <div className="row">
                  <button className="btn sm sec" onClick={() => setEdit({ id: d.id, name: d.name, programs: d.programs.join("\n") })}>Edit</button>
                  <button className="btn sm ghost" onClick={() => window.confirm(`Remove ${d.name}?`) && send({ action: "delete", id: d.id }, "Removed.")}>Remove</button>
                </div>
              )],
            ]} />
          </Card>
        </>
      )}
    </Page>
  );
}
