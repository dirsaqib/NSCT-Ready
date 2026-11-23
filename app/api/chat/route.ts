export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle } from "@/lib/http";

const Body = z.object({
  name: z.string().trim().min(2).max(60).regex(/^[A-Za-z][A-Za-z .'-]*$/, "Use letters only for your name."),
  phone: z.string().trim().regex(/^(\+92|0)3\d{9}$/, "Enter a mobile number like 03001234567.").optional().or(z.literal("")),
  message: z.string().trim().min(3).max(1000),
  page: z.string().max(200).optional(),
  website: z.string().max(0).optional(), // honeypot: real people leave this empty
});

/** Sends a text to the team's WhatsApp through the WhatsApp Business Cloud API, if it is configured. */
async function toWhatsApp(text: string) {
  const token = process.env.WHATSAPP_TOKEN, phoneId = process.env.WHATSAPP_PHONE_ID, to = process.env.WHATSAPP_TO;
  if (!token || !phoneId || !to) return false;
  const template = process.env.WHATSAPP_TEMPLATE; // optional approved template with one body parameter
  const payload = template
    ? { messaging_product: "whatsapp", to, type: "template", template: { name: template, language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" }, components: [{ type: "body", parameters: [{ type: "text", text: text.slice(0, 1000) }] }] } }
    : { messaging_product: "whatsapp", to, type: "text", text: { body: text.slice(0, 4000) } };
  try {
    const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return r.ok;
  } catch {
    return false;
  }
}

/** A visitor's message from the website chat. Saved first, then forwarded to WhatsApp. */
export const POST = handle(async (req: Request) => {
  const b = Body.parse(await req.json());
  if (b.website) return { ok: true, whatsapp: false };
  const lead = await prisma.chatLead.create({ data: { name: b.name, phone: b.phone || null, message: b.message, page: b.page || null } });
  const sent = await toWhatsApp(`New TayariHub chat message\nName: ${b.name}\nPhone: ${b.phone || "not given"}\nPage: ${b.page || "home"}\n\n${b.message}`);
  if (sent) await prisma.chatLead.update({ where: { id: lead.id }, data: { sentWhatsApp: true } });
  return { ok: true, whatsapp: sent };
});
