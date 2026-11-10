import { prisma } from "@/lib/db";
import { handle } from "@/lib/http";

/** Campuses and departments of a university, used by the sign-up form. */
export const GET = handle(async (_req: Request, ctx: { params: { id: string } }) => ({
  campuses: await prisma.campus.findMany({
    where: { universityId: ctx.params.id }, orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, departments: { select: { id: true, name: true, programs: true }, orderBy: { name: "asc" } } },
  }),
}));
