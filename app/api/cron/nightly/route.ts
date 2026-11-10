import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recomputeDiscrimination } from "@/lib/integrity";
import { buildSnapshot } from "@/lib/reports";
import { getSetting } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { TEST_DATE } from "@/lib/syllabus";

/**
 * Nightly jobs (run at 02:00 Pakistan time):
 * 1. Recompute question discrimination.
 * 2. Publish the scheduled weekly HEC report on Mondays.
 * 3. Send countdown reminders to inactive students at 7, 3 and 1 days before the test.
 * 4. Remind focal persons about students waiting more than 48 hours for verification.
 */
export async function POST(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const out: Record<string, unknown> = {};

  await recomputeDiscrimination();
  out.discrimination = "done";

  const now = new Date();
  if (now.getUTCDay() === 1) {
    const mg = await getSetting<number>("reports.minGroup");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = await prisma.reportSnapshot.create({ data: { createdById: "system", minGroup: mg, scheduled: true, data: (await buildSnapshot(mg)) as any } });
    const gov = await prisma.user.findMany({ where: { role: "GOV" }, select: { id: true } });
    await notify(gov.map((g) => g.id), "New weekly NSCT readiness report", "The latest anonymised national report is ready.", ["EMAIL"], "/gov");
    out.snapshot = s.id;
  }

  const days = Math.ceil((TEST_DATE.getTime() - now.getTime()) / 86400000);
  if ((await getSetting<number[]>("notify.reminderDays")).includes(days)) {
    const idle = await prisma.profile.findMany({ where: { user: { attempts: { none: { startedAt: { gte: new Date(now.getTime() - 3 * 86400000) } } } } }, select: { userId: true } });
    out.reminders = await notify(idle.map((p) => p.userId), `${days} day${days === 1 ? "" : "s"} to NSCT`, "Take a mock test today to check your readiness.", ["SMS", "WHATSAPP"], "/mock");
  }

  const waiting = await prisma.profile.groupBy({ by: ["universityId"], where: { user: { status: "PENDING" }, createdAt: { lte: new Date(now.getTime() - 48 * 3600000) } }, _count: true });
  for (const w of waiting) {
    const focal = await prisma.user.findMany({ where: { universityId: w.universityId, role: { in: ["FOCAL", "CAMPUS_ADMIN"] } }, select: { id: true } });
    await notify(focal.map((f) => f.id), "Students waiting for verification", `${w._count} students have waited more than 48 hours.`, ["EMAIL"], "/students?status=PENDING");
  }
  out.verificationReminders = waiting.length;
  return NextResponse.json(out);
}
