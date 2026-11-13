// Always read fresh from the database, never a copy saved at build time.
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { handle } from "@/lib/http";

export const GET = handle(async () => ({
  universities: await prisma.university.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, city: true } }),
}));
