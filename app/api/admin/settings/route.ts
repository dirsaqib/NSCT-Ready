import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/http";
import { DEFAULTS, allSettings, setSetting } from "@/lib/settings";
import { audit } from "@/lib/audit";

/** Notifications, branding, content, scoring rules, pricing and limits. */
export const GET = handle(async () => {
  await requireRole("ADMIN");
  return { settings: await allSettings() };
});

export const PUT = handle(async (req: Request) => {
  const u = await requireRole("ADMIN");
  const b = z.record(z.string(), z.unknown()).parse(await req.json());
  for (const [k, v] of Object.entries(b)) {
    if (!(k in DEFAULTS)) continue; // only known settings
    await setSetting(k, v);
  }
  await audit(u.id, "settings.update", null, b);
  return { settings: await allSettings() };
});
