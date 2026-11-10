import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";

export const PATCH = handle(async (req: Request) => {
  const u = await requireUser({ allowWithout2fa: true });
  const { locale } = z.object({ locale: z.enum(["en", "ur"]) }).parse(await req.json());
  await prisma.user.update({ where: { id: u.id }, data: { locale } });
  return { locale };
});
