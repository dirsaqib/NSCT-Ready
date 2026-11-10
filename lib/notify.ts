// Notifications: in-app, email, SMS and WhatsApp. Messages are queued in the database and sent by
// processQueue(), which a cron job calls every minute (see app/api/cron/notify).
import nodemailer from "nodemailer";
import type { Channel } from "@prisma/client";
import { prisma } from "./db";
import { getSetting } from "./settings";

const mailer = process.env.EMAIL_SERVER ? nodemailer.createTransport(process.env.EMAIL_SERVER) : null;

export async function sendEmail(to: string, subject: string, text: string) {
  if (!mailer) throw new Error("EMAIL_SERVER not configured");
  await mailer.sendMail({ from: process.env.EMAIL_FROM, to, subject, text });
}

/**
 * SMS through any HTTP gateway (for example a Pakistani bulk SMS provider or Twilio).
 * Configure SMS_API_URL, SMS_API_KEY and SMS_SENDER. The body below is generic: adjust the field
 * names to match your provider's documentation.
 */
export async function sendSms(to: string, text: string) {
  if (!process.env.SMS_API_URL) {
    if (process.env.NODE_ENV !== "production") { console.log(`[sms to ${to}] ${text}`); return; }
    throw new Error("SMS_API_URL not configured");
  }
  const r = await fetch(process.env.SMS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SMS_API_KEY}` },
    body: JSON.stringify({ to, from: process.env.SMS_SENDER, message: text }),
  });
  if (!r.ok) throw new Error(`SMS failed: ${r.status}`);
}

/** WhatsApp Business Cloud API. Business-initiated messages must use an approved template. */
export async function sendWhatsApp(to: string, title: string, body: string) {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID, token = process.env.WHATSAPP_TOKEN;
  if (!id || !token) throw new Error("WhatsApp not configured");
  const r = await fetch(`https://graph.facebook.com/v20.0/${id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace("+", ""),
      type: "template",
      template: { name: process.env.WHATSAPP_TEMPLATE || "nsct_update", language: { code: "en" }, components: [{ type: "body", parameters: [{ type: "text", text: title }, { type: "text", text: body.slice(0, 900) }] }] },
    }),
  });
  if (!r.ok) throw new Error(`WhatsApp failed: ${r.status}`);
}

/** Queue one message for many users on the chosen channels. In-app is always included. */
export async function notify(userIds: string[], title: string, body: string, channels: Channel[] = ["IN_APP"], link?: string) {
  const set = new Set<Channel>(["IN_APP", ...channels]);
  const enabled = (await getSetting("notify.channels")) as Channel[];
  const rows = userIds.flatMap((userId) =>
    [...set].filter((c) => c === "IN_APP" || enabled.includes(c)).map((channel) => ({
      userId, channel, title, body, link, status: channel === "IN_APP" ? "SENT" : "QUEUED", sentAt: channel === "IN_APP" ? new Date() : null,
    })),
  );
  for (let i = 0; i < rows.length; i += 1000) await prisma.notification.createMany({ data: rows.slice(i, i + 1000) });
  return rows.length;
}

export async function processQueue(batch = 200) {
  const jobs = await prisma.notification.findMany({
    where: { status: "QUEUED" },
    take: batch,
    orderBy: { createdAt: "asc" },
    include: { user: { select: { email: true, phone: true } } },
  });
  let sent = 0;
  for (const j of jobs) {
    try {
      if (j.channel === "EMAIL") {
        if (!j.user.email) throw new Error("no email");
        await sendEmail(j.user.email, j.title, `${j.body}${j.link ? `\n\n${process.env.NEXTAUTH_URL}${j.link}` : ""}`);
      } else if (j.channel === "SMS") {
        if (!j.user.phone) throw new Error("no phone");
        await sendSms(j.user.phone, `${j.title}: ${j.body}`.slice(0, 300));
      } else if (j.channel === "WHATSAPP") {
        if (!j.user.phone) throw new Error("no phone");
        await sendWhatsApp(j.user.phone, j.title, j.body);
      }
      await prisma.notification.update({ where: { id: j.id }, data: { status: "SENT", sentAt: new Date() } });
      sent++;
    } catch (e) {
      await prisma.notification.update({ where: { id: j.id }, data: { status: "FAILED", error: String((e as Error).message).slice(0, 200) } });
    }
  }
  return { processed: jobs.length, sent };
}
