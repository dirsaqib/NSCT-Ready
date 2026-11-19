export const dynamic = "force-dynamic";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { finalizeExpired } from "@/lib/tests";
import { mocks } from "@/lib/student";

/** Mock 1, 2 and 3 for the student, with guidance from the latest one. */
export const GET = handle(async () => {
  const u = await requireUser();
  await finalizeExpired(u.id).catch(() => null);
  return mocks(u.id, u.universityId);
});
