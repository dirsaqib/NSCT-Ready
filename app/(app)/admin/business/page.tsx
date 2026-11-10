"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Page, Card, Stat, useApi, Loading, Table, Tabs, Pill, JsonForm, fmtDate, lakh } from "@/components/ui";

type Plan = { id: string; packageName: string; studentLimit: number; priceLakh: number; startsAt: string; renewsAt: string; active: boolean; universityId: string; university: { name: string; _count: { profiles: number } } };
type Sponsor = { id: string; name: string; website: string | null; contractStart: string | null; contractEnd: string | null; sponsorships: { id: string; seats: number; amountLakh: number; universityId: string | null; endsAt: string }[]; _count: { users: number } };
type Code = { code: string; percentOff: number; maxUses: number; used: number; expiresAt: string | null; active: boolean };
type Pay = { id: string; amountPkr: number; method: string; months: number; status: string; createdAt: string; user: { email: string | null; phone: string | null; profile: { fullName: string } | null } };
type Inv = { id: string; number: string; totalPkr: number; issuedAt: string; paymentId: string };
type Emp = { id: string; name: string; website: string | null; verified: boolean; _count: { users: number; shortlists: number; assessments: number } };
type B = { plans: Plan[]; sponsors: Sponsor[]; codes: Code[]; payments: Pay[]; invoices: Inv[]; employers: Emp[]; revenue: { totalPkr: number; payments: number } };

const today = () => new Date().toISOString().slice(0, 10);
const inYear = () => new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

/** University plans, sponsors, discount codes, payments, invoices and employers. Amounts in lakh. */
export default function Business() {
  const { data: d, error, reload } = useApi<B>("/api/admin/business");
  const unis = useApi<{ universities: { id: string; name: string }[] }>("/api/universities");
  const [tab, setTab] = useState<"plans" | "sponsors" | "codes" | "payments" | "employers">("plans");
  const [key, setKey] = useState("");
  const op = async (body: object) => { const r = await api<{ apiKey?: string }>("/api/admin/business", { body }); if (r.apiKey) setKey(r.apiKey); reload(); };
  if (!d) return <Loading error={error} />;
  const renewSoon = d.plans.filter((p) => p.active && new Date(p.renewsAt).getTime() - Date.now() < 60 * 86400000);
  const UniSelect = ({ name, optional }: { name: string; optional?: boolean }) => <select name={name} required={!optional}>{optional && <option value="">All universities</option>}{unis.data?.universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>;
  return (
    <Page title="Business and payments" sub="Everything that brings in money or partners.">
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat k="Student payments" v={lakh(d.revenue.totalPkr)} d={`${d.revenue.payments} paid`} />
        <Stat k="University contracts" v={`PKR ${d.plans.filter((p) => p.active).reduce((s, p) => s + p.priceLakh, 0).toFixed(2)} lakh`} d={`${d.plans.filter((p) => p.active).length} active plans`} />
        <Stat k="Sponsorship" v={`PKR ${d.sponsors.flatMap((s) => s.sponsorships).reduce((s, x) => s + x.amountLakh, 0).toFixed(2)} lakh`} d={`${d.sponsors.length} sponsors`} />
        <Stat k="Renewals in 60 days" v={renewSoon.length} d={renewSoon.map((p) => p.university.name).slice(0, 2).join(", ")} />
      </div>
      {key && <div className="notice" style={{ marginBottom: 12 }}>New API key, shown once. Copy it now: <code>{key}</code></div>}
      <div className="card">
        <Tabs value={tab} onChange={setTab} tabs={[["plans", "University plans"], ["sponsors", "Sponsors"], ["codes", "Discount codes"], ["payments", "Payments and invoices"], ["employers", "Employers"]]} />
        {tab === "plans" && (
          <div className="grid g2">
            <Table rows={d.plans} cols={[["University", (p) => <b>{p.university.name}</b>], ["Package", (p) => p.packageName], ["Seats", (p) => `${p.university._count.profiles} of ${p.studentLimit}`], ["Price", (p) => `PKR ${p.priceLakh} lakh`], ["Renews", (p) => fmtDate(p.renewsAt)], ["", (p) => (p.active ? <Pill>active</Pill> : <Pill tone="grey">ended</Pill>)]]} />
            <JsonForm submit="Add plan" onSubmit={(v) => op({ kind: "plan", universityId: v.universityId, packageName: v.packageName, studentLimit: Number(v.studentLimit), priceLakh: Number(v.priceLakh), startsAt: v.startsAt, renewsAt: v.renewsAt, active: true })}>
              <label className="f">University<UniSelect name="universityId" /></label>
              <div className="grid g3"><label className="f">Package<input name="packageName" type="text" required defaultValue="Campus Pro" /></label><label className="f">Student limit<input name="studentLimit" type="number" required defaultValue={1000} /></label><label className="f">Price (lakh)<input name="priceLakh" type="number" step="0.01" required /></label></div>
              <div className="grid g2"><label className="f">Starts<input name="startsAt" type="date" defaultValue={today()} /></label><label className="f">Renews<input name="renewsAt" type="date" defaultValue={inYear()} /></label></div>
            </JsonForm>
          </div>
        )}
        {tab === "sponsors" && (
          <div className="grid g2">
            <div>
              {d.sponsors.map((s) => (
                <div key={s.id} className="q"><b>{s.name}</b> <span className="tiny muted">{s._count.users} logins · contract {fmtDate(s.contractStart)} to {fmtDate(s.contractEnd)}</span>
                  {s.sponsorships.map((x) => <div key={x.id} className="small">{x.seats} seats · PKR {x.amountLakh} lakh · ends {fmtDate(x.endsAt)} · {unis.data?.universities.find((u) => u.id === x.universityId)?.name ?? "All universities"}</div>)}
                </div>
              ))}
            </div>
            <div className="grid" style={{ gap: 16 }}>
              <JsonForm submit="Add sponsor" onSubmit={(v) => op({ kind: "sponsor", name: v.name, website: v.website, contractStart: v.contractStart || undefined, contractEnd: v.contractEnd || undefined })}>
                <label className="f">Sponsor name<input name="name" type="text" required /></label>
                <label className="f">Website<input name="website" type="url" /></label>
                <div className="grid g2"><label className="f">Contract start<input name="contractStart" type="date" /></label><label className="f">Contract end<input name="contractEnd" type="date" /></label></div>
              </JsonForm>
              <JsonForm submit="Add sponsorship" onSubmit={(v) => op({ kind: "sponsorship", sponsorId: v.sponsorId, universityId: v.universityId || null, seats: Number(v.seats), amountLakh: Number(v.amountLakh), startsAt: v.startsAt, endsAt: v.endsAt, brandOnCertificates: !!v.brand })}>
                <label className="f">Sponsor<select name="sponsorId" required>{d.sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                <label className="f">University<UniSelect name="universityId" optional /></label>
                <div className="grid g2"><label className="f">Seats<input name="seats" type="number" required /></label><label className="f">Amount (lakh)<input name="amountLakh" type="number" step="0.01" required /></label></div>
                <div className="grid g2"><label className="f">Starts<input name="startsAt" type="date" defaultValue={today()} /></label><label className="f">Ends<input name="endsAt" type="date" defaultValue={inYear()} /></label></div>
                <label className="check"><input type="checkbox" name="brand" value="1" defaultChecked /><span>Show sponsor on certificates</span></label>
              </JsonForm>
            </div>
          </div>
        )}
        {tab === "codes" && (
          <div className="grid g2">
            <Table rows={d.codes} cols={[["Code", (c) => <code>{c.code}</code>], ["Off", (c) => `${c.percentOff}%`], ["Used", (c) => `${c.used} of ${c.maxUses}`], ["Expires", (c) => fmtDate(c.expiresAt)], ["", (c) => <button className="btn ghost sm" onClick={() => op({ kind: "code", code: c.code, percentOff: c.percentOff, maxUses: c.maxUses, active: !c.active })}>{c.active ? "Disable" : "Enable"}</button>]]} />
            <JsonForm submit="Save code" onSubmit={(v) => op({ kind: "code", code: v.code.toUpperCase(), percentOff: Number(v.percentOff), maxUses: Number(v.maxUses), expiresAt: v.expiresAt || undefined })}>
              <label className="f">Code<input name="code" type="text" required pattern="[A-Za-z0-9-]{3,30}" /></label>
              <div className="grid g3"><label className="f">Percent off<input name="percentOff" type="number" min={1} max={100} required /></label><label className="f">Max uses<input name="maxUses" type="number" min={1} required /></label><label className="f">Expires<input name="expiresAt" type="date" /></label></div>
            </JsonForm>
          </div>
        )}
        {tab === "payments" && (
          <div className="grid g2">
            <Table rows={d.payments} cols={[["Student", (p) => <>{p.user.profile?.fullName ?? ""}<div className="tiny muted">{p.user.email ?? p.user.phone}</div></>], ["Pro", (p) => `${p.months} month${p.months > 1 ? "s" : ""}`], ["Amount", (p) => `PKR ${p.amountPkr.toLocaleString()}`], ["Gateway", (p) => p.method.toLowerCase()], ["Status", (p) => <Pill tone={p.status === "PAID" ? undefined : p.status === "FAILED" ? "bad" : "grey"}>{p.status.toLowerCase()}</Pill>], ["Date", (p) => fmtDate(p.createdAt)], ["", (p) => p.status === "PAID" && <button className="btn ghost sm" onClick={() => window.confirm("Mark as refunded? Send the money back in the gateway portal first.") && op({ kind: "refund", paymentId: p.id })}>Refund</button>]]} />
            <Table rows={d.invoices} cols={[["Invoice", (i) => <code>{i.number}</code>], ["Amount", (i) => `PKR ${i.totalPkr.toLocaleString()}`], ["Issued", (i) => fmtDate(i.issuedAt)]]} />
          </div>
        )}
        {tab === "employers" && (
          <div className="grid g2">
            <Table rows={d.employers} cols={[["Employer", (e) => <b>{e.name}</b>], ["Users", (e) => e._count.users], ["Shortlisted", (e) => e._count.shortlists], ["Tests", (e) => e._count.assessments], ["Status", (e) => <button className="btn ghost sm" onClick={() => op({ kind: "employer", id: e.id, name: e.name, website: e.website ?? "", verified: !e.verified })}>{e.verified ? "Verified · revoke" : "Verify"}</button>], ["API", (e) => <button className="btn ghost sm" onClick={() => op({ kind: "employer", id: e.id, name: e.name, website: e.website ?? "", verified: e.verified, newApiKey: true })}>New key</button>]]} />
            <JsonForm submit="Add employer" onSubmit={(v) => op({ kind: "employer", name: v.name, website: v.website, verified: !!v.verified })}>
              <label className="f">Company<input name="name" type="text" required /></label>
              <label className="f">Website<input name="website" type="url" /></label>
              <label className="check"><input type="checkbox" name="verified" value="1" /><span>Verified (can search the talent pool)</span></label>
            </JsonForm>
          </div>
        )}
      </div>
    </Page>
  );
}
