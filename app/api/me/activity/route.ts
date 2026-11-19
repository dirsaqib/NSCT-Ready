export const dynamic = "force-dynamic";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { activity } from "@/lib/student";

/** The student's own preparation log: the same record their focal person and the super admin see. */
export const GET = handle(async () => {
  const u = await requireUser();
  return activity(u.id);
});
