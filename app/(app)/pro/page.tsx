"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/components/api";
import { Page, Card, useApi, Loading, Table, fmtDate } from "@/components/ui";

type Q = { base: number; percentOff: number; total: number } | { error: string };
type D = {
  oneMonth: Q; threeMonths: Q; pro: boolean; proUntil: string | null; referralCode: string;
  payments: { id: string; method: string; amountPkr: number; months: number; status: string; createdAt: string; invoice: { number: string } | null }[];
};

export default function ProPage() { return <Suspense fallback={<div className="spin" />}><Pro /></Suspense>; }

/** Pro access for students without a university plan or sponsor. JazzCash, Easypaisa or card. */
function Pro() {
  const status = useSearchParams().get("status");
  const [code, setCode] = useState("");
  const [ref, setRef] = useState("");
  const { data, error } = useApi<D>(`/api/payments/quote?code=${encodeURIComponent(code)}`, [code]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!data) return <Loading error={error} />;
  const price = (q: Q) => ("error" in q ? q.error : q.percentOff ? `PKR ${q.total} (was ${q.base})` : `PKR ${q.total}`);

  const pay = async (method: string, months: 1 | 3) => {
    setBusy(true); setMsg("");
    try {
      const r = await api<{ action: string; fields: Record<string, string> }>("/api/payments/checkout", { body: { method, months, discountCode: code || undefined, referralCode: ref || undefined } });
      const f = document.createElement("form");
      f.method = "POST"; f.action = r.action;
      Object.entries(r.fields).forEach(([k, v]) => { const i = document.createElement("input"); i.type = "hidden"; i.name = k; i.value = v; f.appendChild(i); });
      document.body.appendChild(f); f.submit();
    } catch (e) { setMsg((e as Error).message); setBusy(false); }
  };

  return (
    <Page title="Pro access" sub="Unlimited mock tests, more AI tutor help and certificates.">
      {status === "paid" && <div className="notice info" style={{ marginBottom: 12 }}>Payment received. Your Pro access is active.</div>}
      {status === "failed" && <div className="notice bad" style={{ marginBottom: 12 }}>The payment did not go through. You were not charged. Please try again.</div>}
      {data.pro ? (
        <Card><h2>You have Pro access</h2><p>{data.proUntil ? `Paid access until ${fmtDate(data.proUntil)}.` : "Provided by your university plan or a sponsor."}</p></Card>
      ) : (
        <div className="grid g2" style={{ marginBottom: 16 }}>
          {([[1, data.oneMonth, "1 month"], [3, data.threeMonths, "3 months, best for NSCT 2027"]] as const).map(([m, q, l]) => (
            <Card key={m} title={l}>
              <div className="stat"><div className="v">{price(q)}</div></div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn" disabled={busy || "error" in q} onClick={() => pay("JAZZCASH", m)}>JazzCash</button>
                <button className="btn" disabled={busy || "error" in q} onClick={() => pay("EASYPAISA", m)}>Easypaisa</button>
                <button className="btn sec" disabled={busy || "error" in q} onClick={() => pay("CARD", m)}>Debit or credit card</button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {msg && <div className="notice bad" style={{ marginBottom: 12 }}>{msg}</div>}
      <div className="grid g2" style={{ marginBottom: 16 }}>
        <Card title="Discount or referral code">
          <div className="grid" style={{ gap: 10 }}>
            <input type="text" placeholder="Discount code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <input type="text" placeholder="Friend's referral code" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} />
          </div>
        </Card>
        <Card title="Invite friends">
          <p className="small">Share your code. When a friend buys Pro with it, you get 7 extra days free.</p>
          <div className="row"><code style={{ fontSize: 18 }}>{data.referralCode}</code><button className="btn sm sec" onClick={() => navigator.clipboard.writeText(data.referralCode)}>Copy</button></div>
        </Card>
      </div>
      <Card title="Payment history">
        <Table rows={data.payments} cols={[["Date", (p) => fmtDate(p.createdAt)], ["Method", (p) => p.method], ["Months", (p) => p.months], ["Amount", (p) => `PKR ${p.amountPkr}`], ["Status", (p) => p.status], ["Invoice", (p) => p.invoice?.number ?? ""]]} empty="No payments yet." />
      </Card>
      <p className="tiny muted">Students whose university has a plan, or who are sponsored, get Pro access automatically.</p>
    </Page>
  );
}
