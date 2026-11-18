export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";

// Each university keeps its own list of departments and programs, set by its focal person.
// Departments are stored under the university's "Main campus" because students now type their campus freely.

async function uniFor(u: { role: string; universityId: string | null }, requested: string | null) {
  const id = u.role === "ADMIN" ? requested || u.universityId : u.universityId;
  if (!id) throw new HttpError(400, "Choose a university.");
  return id;
}
async function mainCampus(universityId: string) {
  const uni = await prisma.university.findUnique({ where: { id: universityId }, select: { city: true } });
  return prisma.campus.upsert({ where: { universityId_name: { universityId, name: "Main campus" } }, create: { universityId, name: "Main campus", city: uni?.city }, update: {} });
}
const norm = (s: string) => s.trim().replace(/\s+/g, " ");

/** The university's departments, plus department names students typed that are not on the list yet. */
export const GET = handle(async (req: Request) => {
  const u = await requireRole("FOCAL");
  const universityId = await uniFor(u, new URL(req.url).searchParams.get("universityId"));
  const departments = await prisma.department.findMany({
    where: { campus: { universityId } }, orderBy: { name: "asc" },
    select: { id: true, name: true, programs: true, campus: { select: { name: true } }, _count: { select: { profiles: true } } },
  });
  const typed = await prisma.profile.groupBy({ by: ["departmentName"], where: { universityId, departmentId: null, departmentName: { not: null } }, _count: true });
  return { departments, unlisted: typed.filter((t) => t.departmentName).map((t) => ({ name: t.departmentName!, students: t._count })) };
});

const Save = z.object({
  action: z.enum(["save", "adopt", "delete"]),
  id: z.string().optional(),
  name: z.string().min(2).max(100).optional(),
  programs: z.array(z.string().min(2).max(100)).max(30).optional(),
  universityId: z.string().optional(),
  mergeFrom: z.string().max(100).optional(),
});

/** Add, rename or remove a department, or adopt a name students typed (links those students to it). */
export const POST = handle(async (req: Request) => {
  const u = await requireRole("FOCAL");
  const b = Save.parse(await req.json());
  const universityId = await uniFor(u, b.universityId ?? null);
  const own = async (id: string) => {
    const d = await prisma.department.findUnique({ where: { id }, include: { campus: true } });
    if (!d || d.campus.universityId !== universityId) throw new HttpError(404, "Department not found.");
    return d;
  };

  if (b.action === "delete") {
    const d = await own(b.id ?? "");
    const used = await prisma.profile.count({ where: { departmentId: d.id } });
    if (used) throw new HttpError(400, `${used} students belong to this department. Move them first, or rename the department instead.`);
    await prisma.department.delete({ where: { id: d.id } });
    await audit(u.id, "department.delete", d.id, { name: d.name });
    return { ok: true };
  }

  const name = norm(b.name ?? "");
  if (name.length < 2) throw new HttpError(400, "Enter the department name.");
  const programs = [...new Set((b.programs ?? []).map(norm).filter(Boolean))];
  const clash = await prisma.department.findFirst({ where: { campus: { universityId }, name: { equals: name, mode: "insensitive" }, ...(b.id ? { id: { not: b.id } } : {}) } });

  let dept;
  if (b.action === "save" && b.id) {
    if (clash) throw new HttpError(409, "Your university already has a department with this name.");
    await own(b.id);
    dept = await prisma.department.update({ where: { id: b.id }, data: { name, programs } });
  } else {
    dept = clash ?? (await prisma.department.create({ data: { campusId: (await mainCampus(universityId)).id, name, programs } }));
    if (clash && programs.length) dept = await prisma.department.update({ where: { id: clash.id }, data: { programs: [...new Set([...clash.programs, ...programs])] } });
  }

  // Link every student of this university who typed this department name and is not linked yet.
  const typedName = b.mergeFrom ? norm(b.mergeFrom) : name;
  const profiles = await prisma.profile.findMany({ where: { universityId, departmentId: null, departmentName: { equals: typedName, mode: "insensitive" } }, select: { userId: true } });
  if (profiles.length) {
    const ids = profiles.map((p) => p.userId);
    await prisma.profile.updateMany({ where: { userId: { in: ids } }, data: { departmentId: dept.id } });
    await prisma.user.updateMany({ where: { id: { in: ids } }, data: { departmentId: dept.id } });
  }
  await audit(u.id, `department.${b.action}`, dept.id, { name, linked: profiles.length });
  return { ok: true, department: dept, linked: profiles.length };
});
