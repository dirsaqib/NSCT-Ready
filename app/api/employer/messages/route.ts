import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAnyRole, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { notify } from "@/lib/notify";

/** Employers contact talent-pool students inside the platform. Contact details stay private. */
export const GET = handle(async (req: Request) => {
  const u = await requireAnyRole(["EMPLOYER"]);
  const candidateId = new URL(req.url).searchParams.get("candidateId");
  return {
    messages: await prisma.employerMessage.findMany({
      where: { employerId: u.employerId ?? "-", ...(candidateId ? { OR: [{ toId: candidateId }, { fromId: candidateId }] } : {}) },
      orderBy: { createdAt: "asc" }, take: 500,
    }),
  };
});

export const POST = handle(async (req: Request) => {
  const u = await requireAnyRole(["EMPLOYER"]);
  const b = z.object({ candidateId: z.string(), body: z.string().trim().min(5).max(2000) }).parse(await req.json());
  const p = await prisma.profile.findUnique({ where: { userId: b.candidateId } });
  if (!p?.talentPool) throw new HttpError(403, "This student is not in the talent pool.");
  const emp = await prisma.employer.findUnique({ where: { id: u.employerId ?? "-" } });
  if (!emp?.verified) throw new HttpError(403, "Your organisation is not verified yet.");
  const m = await prisma.employerMessage.create({ data: { employerId: emp.id, fromId: u.id, toId: b.candidateId, body: b.body } });
  await prisma.shortlist.updateMany({ where: { employerId: emp.id, candidateId: b.candidateId, stage: "SHORTLISTED" }, data: { stage: "CONTACTED" } });
  await notify([b.candidateId], `Message from ${emp.name}`, b.body.slice(0, 200), ["EMAIL"], "/messages");
  return { message: m };
});
