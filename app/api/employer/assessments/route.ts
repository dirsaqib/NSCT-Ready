export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAnyRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import { publicCode } from "@/lib/crypto";

/** Employers build their own hiring tests on the same engine and share an invite code with candidates. */
export const GET = handle(async () => {
  const u = await requireAnyRole(["EMPLOYER"]);
  const list = await prisma.employerAssessment.findMany({ where: { employerId: u.employerId ?? "-" }, orderBy: { createdAt: "desc" } });
  const results = await prisma.attempt.findMany({
    where: { assessmentId: { in: list.map((a) => a.id) }, submittedAt: { not: null } },
    orderBy: { score: "desc" },
    select: { assessmentId: true, score: true, submittedAt: true, flags: true, user: { select: { id: true, profile: { select: { fullName: true, program: true, university: { select: { name: true } } } } } } },
  });
  return { assessments: list.map((a) => ({ ...a, results: results.filter((r) => r.assessmentId === a.id) })) };
});

export const POST = handle(async (req: Request) => {
  const u = await requireAnyRole(["EMPLOYER"]);
  const b = z.object({
    title: z.string().min(3).max(120),
    counts: z.record(z.enum(["PS", "PROG", "DSA", "DB", "SE", "WEB", "AI", "NET", "OS", "SEC"]), z.number().int().min(0).max(40)),
    durationMin: z.number().int().min(10).max(180),
  }).parse(await req.json());
  return { assessment: await prisma.employerAssessment.create({ data: { ...b, employerId: u.employerId!, inviteCode: publicCode("HIRE") } }) };
});
