export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { publicCode, sha256 } from "@/lib/crypto";

/** University plans, sponsors and sponsorships, discount codes, payments and invoices, employers. */
export const GET = handle(async () => {
  await requireRole("ADMIN");
  const [plans, sponsors, codes, payments, invoices, employers, revenue] = await Promise.all([
    prisma.universityPlan.findMany({ orderBy: { renewsAt: "asc" }, include: { university: { select: { name: true, _count: { select: { profiles: true } } } } } }),
    prisma.sponsor.findMany({ include: { sponsorships: true, _count: { select: { users: true } } } }),
    prisma.discountCode.findMany({ orderBy: { code: "asc" } }),
    prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { email: true, phone: true, profile: { select: { fullName: true } } } } } }),
    prisma.invoice.findMany({ orderBy: { issuedAt: "desc" }, take: 200 }),
    prisma.employer.findMany({ include: { _count: { select: { users: true, shortlists: true, assessments: true } } } }),
    prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amountPkr: true }, _count: true }),
  ]);
  return { plans, sponsors, codes, payments, invoices, employers, revenue: { totalPkr: revenue._sum.amountPkr ?? 0, payments: revenue._count } };
});

const Op = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plan"), id: z.string().optional(), universityId: z.string(), packageName: z.string().min(2).max(80), studentLimit: z.number().int().min(1), priceLakh: z.number().min(0), startsAt: z.string(), renewsAt: z.string(), active: z.boolean().default(true) }),
  z.object({ kind: z.literal("sponsor"), id: z.string().optional(), name: z.string().min(2).max(120), logoUrl: z.string().url().optional().or(z.literal("")), website: z.string().url().optional().or(z.literal("")), contractStart: z.string().optional(), contractEnd: z.string().optional() }),
  z.object({ kind: z.literal("sponsorship"), id: z.string().optional(), sponsorId: z.string(), universityId: z.string().nullable().optional(), seats: z.number().int().min(1), amountLakh: z.number().min(0), startsAt: z.string(), endsAt: z.string(), brandOnCertificates: z.boolean().default(true) }),
  z.object({ kind: z.literal("code"), code: z.string().regex(/^[A-Z0-9-]{3,30}$/), percentOff: z.number().int().min(1).max(100), maxUses: z.number().int().min(1), expiresAt: z.string().optional(), active: z.boolean().default(true) }),
  z.object({ kind: z.literal("employer"), id: z.string().optional(), name: z.string().min(2).max(120), website: z.string().url().optional().or(z.literal("")), verified: z.boolean().default(false), newApiKey: z.boolean().optional() }),
  z.object({ kind: z.literal("refund"), paymentId: z.string() }),
]);

export const POST = handle(async (req: Request) => {
  const u = await requireRole("ADMIN");
  const b = Op.parse(await req.json());
  const d = (s?: string) => (s ? new Date(s) : undefined);
  let out: Record<string, unknown> = {};
  switch (b.kind) {
    case "plan": { const { kind: _k, id, startsAt, renewsAt, ...r } = b; const data = { ...r, startsAt: new Date(startsAt), renewsAt: new Date(renewsAt) }; out = { plan: id ? await prisma.universityPlan.update({ where: { id }, data }) : await prisma.universityPlan.create({ data }) }; break; }
    case "sponsor": { const { kind: _k, id, contractStart, contractEnd, ...r } = b; const data = { ...r, logoUrl: r.logoUrl || null, website: r.website || null, contractStart: d(contractStart), contractEnd: d(contractEnd) }; out = { sponsor: id ? await prisma.sponsor.update({ where: { id }, data }) : await prisma.sponsor.create({ data }) }; break; }
    case "sponsorship": { const { kind: _k, id, startsAt, endsAt, ...r } = b; const data = { ...r, universityId: r.universityId ?? null, startsAt: new Date(startsAt), endsAt: new Date(endsAt) }; out = { sponsorship: id ? await prisma.sponsorship.update({ where: { id }, data }) : await prisma.sponsorship.create({ data }) }; break; }
    case "code": { const { kind: _k, expiresAt, ...r } = b; const data = { ...r, expiresAt: d(expiresAt) }; out = { code: await prisma.discountCode.upsert({ where: { code: r.code }, create: data, update: data }) }; break; }
    case "employer": {
      const { kind: _k, id, newApiKey, ...r } = b;
      const key = newApiKey ? `nrk_${publicCode("K").replace(/-/g, "")}${Date.now().toString(36)}` : null;
      const data = { ...r, website: r.website || null, ...(key ? { apiKeyHash: sha256(key) } : {}) };
      out = { employer: id ? await prisma.employer.update({ where: { id }, data }) : await prisma.employer.create({ data }), apiKey: key };
      break;
    }
    case "refund": out = { payment: await prisma.payment.update({ where: { id: b.paymentId }, data: { status: "REFUNDED" } }) }; break;
  }
  await audit(u.id, `business.${b.kind}`, null, { ...b, ...(b.kind === "employer" ? { newApiKey: !!b.newApiKey } : {}) });
  return out;
});
