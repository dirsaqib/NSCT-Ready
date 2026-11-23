export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";

/** Latest website chat messages for the super admin. */
export const GET = handle(async () => {
  await requireRole("ADMIN");
  const rows = await prisma.chatLead.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  return { rows, whatsapp: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TO) };
});
