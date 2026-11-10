import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";

/** Everything stored about the signed-in student, for the "download my data" right. */
export const GET = handle(async () => {
  const u = await requireUser();
  const [user, profile, attempts, mastery, topics, mistakes] = await Promise.all([
    prisma.user.findUnique({ where: { id: u.id }, select: { email: true, name: true, createdAt: true } }),
    prisma.profile.findUnique({ where: { userId: u.id } }),
    prisma.attempt.findMany({ where: { userId: u.id }, include: { items: true } }),
    prisma.mastery.findMany({ where: { userId: u.id } }),
    prisma.topicMastery.findMany({ where: { userId: u.id } }),
    prisma.mistake.findMany({ where: { userId: u.id } }),
  ]);
  return { exportedAt: new Date(), user, profile, attempts, mastery, topics, mistakes };
});
