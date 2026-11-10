import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { getAttemptForStudent } from "@/lib/tests";

export const GET = handle(async (_req: Request, ctx: { params: { id: string } }) => {
  const u = await requireUser();
  return getAttemptForStudent(u.id, ctx.params.id);
});
