import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAnyRole, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";

export const GET = handle(async () => {
  const u = await requireAnyRole(["EMPLOYER"]);
  return {
    shortlist: await prisma.shortlist.findMany({
      where: { employerId: u.employerId ?? "-" }, orderBy: { createdAt: "desc" },
      include: { candidate: { select: { id: true, profile: { select: { fullName: true, program: true, readiness: true, bestMock: true, university: { select: { name: true } } } } } } },
    }),
  };
});

export const POST = handle(async (req: Request) => {
  const u = await requireAnyRole(["EMPLOYER"]);
  const b = z.object({ candidateId: z.string(), note: z.string().max(500).optional(), stage: z.enum(["SHORTLISTED", "CONTACTED", "INTERVIEW", "HIRED", "CLOSED"]).optional() }).parse(await req.json());
  const p = await prisma.profile.findUnique({ where: { userId: b.candidateId } });
  if (!p?.talentPool) throw new HttpError(403, "This student is not in the talent pool.");
  const row = await prisma.shortlist.upsert({
    where: { employerId_candidateId: { employerId: u.employerId!, candidateId: b.candidateId } },
    create: { employerId: u.employerId!, candidateId: b.candidateId, note: b.note, stage: b.stage ?? "SHORTLISTED" },
    update: { ...(b.note !== undefined ? { note: b.note } : {}), ...(b.stage ? { stage: b.stage } : {}) },
  });
  return { shortlist: row };
});

export const DELETE = handle(async (req: Request) => {
  const u = await requireAnyRole(["EMPLOYER"]);
  const { candidateId } = z.object({ candidateId: z.string() }).parse(await req.json());
  await prisma.shortlist.deleteMany({ where: { employerId: u.employerId ?? "-", candidateId } });
  return { ok: true };
});
