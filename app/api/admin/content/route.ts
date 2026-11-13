export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAnyRole, requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

/** Events and awards for top performers. Sponsors see their own events. */
export const GET = handle(async () => {
  const u = await requireAnyRole(["ADMIN", "SPONSOR"]);
  return { events: await prisma.event.findMany({ where: u.role === "SPONSOR" ? { sponsorId: u.sponsorId ?? "-" } : {}, orderBy: { date: "desc" }, include: { sponsor: { select: { name: true } } } }) };
});

export const POST = handle(async (req: Request) => {
  const u = await requireRole("ADMIN");
  const b = z.object({
    id: z.string().optional(), title: z.string().min(3).max(150), date: z.string(), venue: z.string().max(150).optional(), sponsorId: z.string().nullable().optional(),
    awards: z.array(z.object({ title: z.string().min(2).max(100), rank: z.number().int().min(1).max(100), userId: z.string().optional() })).max(100).default([]),
    notifyWinners: z.boolean().default(false),
  }).parse(await req.json());
  const { id, notifyWinners, date, ...d } = b;
  const data = { ...d, date: new Date(date), sponsorId: d.sponsorId ?? null };
  const ev = id ? await prisma.event.update({ where: { id }, data }) : await prisma.event.create({ data });
  if (notifyWinners) {
    const winners = b.awards.filter((a) => a.userId).map((a) => a.userId!);
    await notify(winners, `Congratulations: ${b.title}`, "You have been selected for an award. Details are in your notifications.", ["EMAIL", "SMS"]);
  }
  await audit(u.id, "event.save", ev.id);
  return { event: ev };
});
