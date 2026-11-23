"use client";
import { Page, Card, useApi, Loading, Table, Pill, fmtDateTime } from "@/components/ui";

type Lead = { id: string; name: string; phone: string | null; message: string; page: string | null; sentWhatsApp: boolean; createdAt: string };

/** Messages visitors left in the website chat, so nothing is missed even without WhatsApp. */
export default function Messages() {
  const { data, error } = useApi<{ rows: Lead[]; whatsapp: boolean }>("/api/admin/messages", []);
  return (
    <Page title="Website chat messages" sub="Questions visitors sent from the chat button on the front page and help centre.">
      {!data ? <Loading error={error} /> : (
        <Card>
          {!data.whatsapp && <p className="muted small" style={{ marginTop: 0 }}>Automatic WhatsApp forwarding is off. Add WHATSAPP_TOKEN, WHATSAPP_PHONE_ID and WHATSAPP_TO in Vercel to turn it on.</p>}
          <Table rows={data.rows} empty="No messages yet." cols={[
            ["When", (r) => fmtDateTime(r.createdAt)],
            ["Name", (r) => r.name],
            ["Mobile", (r) => (r.phone ? <a href={`https://wa.me/92${r.phone.replace(/^(\+92|0)/, "")}`} target="_blank" rel="noopener noreferrer">{r.phone}</a> : "–")],
            ["Message", (r) => <span style={{ whiteSpace: "pre-wrap" }}>{r.message}</span>],
            ["WhatsApp", (r) => (r.sentWhatsApp ? <Pill>Sent</Pill> : <Pill tone="grey">Saved</Pill>)],
          ]} />
        </Card>
      )}
    </Page>
  );
}
