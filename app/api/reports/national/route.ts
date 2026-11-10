import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import { buildSnapshot } from "@/lib/reports";
import { MIN_GROUP } from "@/lib/syllabus";
import { z } from "zod";

/** Live preview for the super admin before publishing. HEC users read published snapshots instead. */
export const GET = handle(async (req: Request) => {
  await requireRole("ADMIN");
  const mg = z.coerce.number().int().min(5).max(100).default(MIN_GROUP).parse(new URL(req.url).searchParams.get("minGroup") ?? undefined);
  return buildSnapshot(mg);
});
