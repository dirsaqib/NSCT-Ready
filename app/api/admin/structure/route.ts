export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";

/** Manage the hierarchy: universities, campuses, departments and their programs. */
export const GET = handle(async () => {
  await requireRole("ADMIN");
  return {
    universities: await prisma.university.findMany({
      orderBy: { name: "asc" },
      include: { campuses: { include: { departments: true }, orderBy: { name: "asc" } }, _count: { select: { profiles: true } } },
    }),
  };
});

const Op = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("university"), id: z.string().optional(), name: z.string().min(2).max(150), city: z.string().max(60).optional(), province: z.string().max(60).optional(), sector: z.enum(["Public", "Private"]).optional() }),
  z.object({ kind: z.literal("campus"), id: z.string().optional(), universityId: z.string(), name: z.string().min(2).max(120), city: z.string().max(60).optional(), district: z.string().max(60).optional() }),
  z.object({ kind: z.literal("department"), id: z.string().optional(), campusId: z.string(), name: z.string().min(2).max(120), programs: z.array(z.string().min(2).max(80)).max(30).default([]) }),
]);

export const POST = handle(async (req: Request) => {
  const u = await requireRole("ADMIN");
  const b = Op.parse(await req.json());
  let row: { id: string };
  if (b.kind === "university") { const { kind: _k, id, ...d } = b; row = id ? await prisma.university.update({ where: { id }, data: d }) : await prisma.university.create({ data: d }); }
  else if (b.kind === "campus") { const { kind: _k, id, ...d } = b; row = id ? await prisma.campus.update({ where: { id }, data: d }) : await prisma.campus.create({ data: d }); }
  else { const { kind: _k, id, ...d } = b; row = id ? await prisma.department.update({ where: { id }, data: d }) : await prisma.department.create({ data: d }); }
  await audit(u.id, `structure.${b.kind}.${b.id ? "update" : "create"}`, row.id);
  return { id: row.id };
});

export const DELETE = handle(async (req: Request) => {
  const u = await requireRole("ADMIN");
  const b = z.object({ kind: z.enum(["campus", "department"]), id: z.string() }).parse(await req.json());
  if (b.kind === "campus") await prisma.campus.delete({ where: { id: b.id } });
  else await prisma.department.delete({ where: { id: b.id } });
  await audit(u.id, `structure.${b.kind}.delete`, b.id);
  return { ok: true };
});
