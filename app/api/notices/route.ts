import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, requireUser, profileScope } from "@/lib/auth";
import { handle } from "@/lib/http";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";

const Body = z.object({
  title: z.string().trim().min(3).max(80),
  body: z.string().trim().min(3).max(500),
  universityId: z.string().optional().nullable(),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  action: z.enum(["diagnostic", "mock", "practice", "plan"]).optional().nullable(),
  channels: z.array(z.enum(["EMAIL", "SMS", "WHATSAPP"])).default([]),
});

export const GET = handle(async () => {
  const u = await requireUser();
  const where = u.role === "ADMIN" ? {} : {
    OR: [{ universityId: null }, { universityId: u.universityId ?? "-", campusId: null, departmentId: null }, { campusId: u.campusId ?? "-" }, { departmentId: u.departmentId ?? "-" }],
  };
  return { notices: await prisma.notice.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 }) };
});

/** Staff post to their own part of the hierarchy and choose channels. Admins may post nationally. */
export const POST = handle(async (req: Request) => {
  const u = await requireRole("HOD");
  const b = Body.parse(await req.json());
  const scope = profileScope(u, u.role === "ADMIN" ? b.universityId : null);
  const n = await prisma.notice.create({
    data: {
      title: b.title, body: b.body, universityId: scope.universityId ?? null, campusId: scope.campusId ?? null, departmentId: scope.departmentId ?? null,
      due: b.due ? new Date(b.due) : null, action: b.action || null, channels: ["IN_APP", ...b.channels], createdById: u.id,
    },
  });
  const students = await prisma.profile.findMany({ where: scope, select: { userId: true } });
  const queued = await notify(students.map((s) => s.userId), b.title, b.body, b.channels, b.action ? `/${b.action}` : "/dashboard");
  await audit(u.id, "notice.create", n.id, { recipients: students.length, channels: b.channels });
  return { notice: n, recipients: students.length, queued };
});
