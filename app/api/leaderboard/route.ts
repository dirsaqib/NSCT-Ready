export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";

/** Only students who opted in. Shows nickname, university and best mock, nothing else. */
export const GET = handle(async () => {
  await requireUser();
  const rows = await prisma.profile.findMany({
    where: { leaderboard: true, bestMock: { gt: 0 } },
    orderBy: { bestMock: "desc" },
    take: 100,
    select: { alias: true, fullName: true, bestMock: true, university: { select: { name: true } } },
  });
  const students = rows.map((r) => ({
    alias: r.alias || r.fullName.split(/\s+/).map((w) => w[0]?.toUpperCase()).join("") + ".",
    university: r.university.name,
    best: r.bestMock,
  }));
  const uni = await prisma.profile.groupBy({
    by: ["universityId"],
    where: { leaderboard: true, bestMock: { gt: 0 } },
    _avg: { bestMock: true },
    _count: true,
    having: { universityId: { _count: { gte: 5 } } },
  });
  const names = await prisma.university.findMany({ where: { id: { in: uni.map((x) => x.universityId) } } });
  const universities = uni
    .map((x) => ({ university: names.find((n) => n.id === x.universityId)?.name, students: x._count, avgBest: Math.round(x._avg.bestMock ?? 0) }))
    .sort((a, b) => b.avgBest - a.avgBest);
  return { students, universities };
});
