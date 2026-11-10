"use client";
import Link from "next/link";
import { api } from "@/components/api";
import { Page, Card, JsonForm, useApi, Loading, Table, Pill, fmtDate } from "@/components/ui";

type T = { id: string; category: string; subject: string; status: string; updatedAt: string };

export default function Support() {
  const { data, error, reload } = useApi<{ tickets: T[] }>("/api/tickets");
  return (
    <Page title="Support" sub="Ask the platform team for help. We reply here and by email.">
      <div className="grid g2">
        <Card title="Open a ticket">
          <JsonForm submit="Send" onSubmit={async (v) => { await api("/api/tickets", { body: v }); reload(); }}>
            <label className="f">Topic<select name="category"><option value="account">Account or verification</option><option value="test">Test or results</option><option value="question">A question is wrong</option><option value="payment">Payment</option><option value="university">University or focal person</option><option value="other">Something else</option></select></label>
            <label className="f">Subject<input name="subject" type="text" required minLength={3} /></label>
            <label className="f">Details<textarea name="body" required minLength={5} /></label>
          </JsonForm>
        </Card>
        <Card title="My tickets">
          {!data ? <Loading error={error} /> : <Table rows={data.tickets} cols={[["Subject", (t) => <Link href={`/support/${t.id}`}>{t.subject}</Link>], ["Status", (t) => <Pill tone={t.status === "OPEN" ? "warn" : t.status === "CLOSED" ? "grey" : undefined}>{t.status.toLowerCase()}</Pill>], ["Updated", (t) => fmtDate(t.updatedAt)]]} empty="No tickets." />}
        </Card>
      </div>
    </Page>
  );
}
