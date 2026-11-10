// Platform settings editable by the super admin. Defaults apply until changed.
import { prisma } from "./db";

export const DEFAULTS: Record<string, unknown> = {
  "branding.name": "NSCT Ready",
  "branding.tagline": "Free preparation for NSCT 2027",
  "branding.primaryColor": "#0B6E4F",
  "notify.channels": ["EMAIL", "SMS", "WHATSAPP"],
  "notify.reminderDays": [7, 3, 1],
  "test.negativeMarking": 0,
  "test.passMark": 50,
  "test.multiSelectPartialCredit": true,
  "test.autosaveSeconds": 15,
  "test.fastCompletionSecPerQuestion": 10,
  "test.maxTabSwitches": 3,
  "pricing.proMonthlyPkr": 500,
  "pricing.proThreeMonthPkr": 1200,
  "pricing.freeMockLimit": 1,
  "pricing.freeAiCallsPerDay": 5,
  "ai.dailyLimit": 40,
  "reports.minGroup": 20,
  "reports.scheduleCron": "0 6 * * 1", // Mondays 06:00
  "content.helpEmail": "support@example.com",
};

const cache = new Map<string, { v: unknown; at: number }>();

export async function getSetting<T = unknown>(key: string): Promise<T> {
  const c = cache.get(key);
  if (c && Date.now() - c.at < 30000) return c.v as T;
  const row = await prisma.setting.findUnique({ where: { key } });
  const v = row ? row.value : DEFAULTS[key];
  cache.set(key, { v, at: Date.now() });
  return v as T;
}

export async function setSetting(key: string, value: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.setting.upsert({ where: { key }, create: { key, value: value as any }, update: { value: value as any } });
  cache.delete(key);
}

export async function allSettings() {
  const rows = await prisma.setting.findMany();
  return { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
}
