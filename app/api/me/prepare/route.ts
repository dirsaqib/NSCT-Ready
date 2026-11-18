export const dynamic = "force-dynamic";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { preparation } from "@/lib/student";

/** The student's preparation map: worlds, levels, stars and XP. */
export const GET = handle(async () => {
  const u = await requireUser();
  return preparation(u.id, u.universityId);
});
