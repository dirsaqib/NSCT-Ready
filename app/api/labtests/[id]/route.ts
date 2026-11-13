export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { submitAttempt } from "@/lib/tests";
import { labTestForStaff, monitor, newAccessCode, rosterWhere } from "@/lib/labtests";

type Ctx = { params: { id: string } };

/** Invigilator view: the test, the paper summary and every student's live state. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const u = await requireRole("HOD");
  const t = await labTestForStaff(u, params.id);
  const qs = await prisma.question.findMany({ where: { id: { in: t.questionIds } }, select: { id: true, subject: true, topic: true, type: true, difficulty: true, text: true } });
  const { packageSecret, ...safe } = t;
  return { test: safe, paper: t.questionIds.map((id) => qs.find((q) => q.id === id)).filter(Boolean), ...(await monitor(t)) };
});

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("close") }),
  z.object({ action: z.literal("newCode") }),
  z.object({ action: z.literal("extend"), minutes: z.number().int().min(1).max(120) }),
  z.object({ action: z.literal("release"), notifyStudents: z.boolean().default(true) }),
  z.object({ action: z.literal("reset"), userId: z.string() }),
  z.object({ action: z.literal("submitOne"), userId: z.string() }),
  z.object({ action: z.literal("delete") }),
]);

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireRole("HOD");
  const t = await labTestForStaff(u, params.id);
  const b = Action.parse(await req.json());
  const now = new Date();

  switch (b.action) {
    case "start":
      if (t.mode !== "ONLINE_LAB") throw new HttpError(409, "Offline tests are started on the lab server.");
      if (now > t.closesAt) throw new HttpError(409, "The scheduled time is over. Change the schedule first.");
      await prisma.labTest.update({ where: { id: t.id }, data: { status: "LIVE", wentLiveAt: t.wentLiveAt ?? now, opensAt: now < t.opensAt ? now : t.opensAt } });
      break;
    case "newCode":
      await prisma.labTest.update({ where: { id: t.id }, data: { accessCode: newAccessCode() } });
      break;
    case "extend": {
      await prisma.labTest.update({ where: { id: t.id }, data: { extraMin: { increment: b.minutes }, closesAt: new Date(Math.max(t.closesAt.getTime(), now.getTime()) + b.minutes * 60000) } });
      const running = await prisma.attempt.findMany({ where: { labTestId: t.id, submittedAt: null, endsAt: { not: null } } });
      for (const a of running) await prisma.attempt.update({ where: { id: a.id }, data: { endsAt: new Date(a.endsAt!.getTime() + b.minutes * 60000) } });
      break;
    }
    case "close": {
      // Grades every unsubmitted test with whatever was auto-saved, then locks the test.
      const open = await prisma.attempt.findMany({ where: { labTestId: t.id, submittedAt: null } });
      for (const a of open) await submitAttempt(a.userId, a.id, [], a.tabSwitches, a.fullscreenExits).catch(() => null);
      await prisma.labTest.update({ where: { id: t.id }, data: { status: "CLOSED", closesAt: now < t.closesAt ? now : t.closesAt } });
      break;
    }
    case "submitOne": {
      const a = await prisma.attempt.findFirst({ where: { labTestId: t.id, userId: b.userId, submittedAt: null } });
      if (!a) throw new HttpError(404, "This student has no test in progress.");
      await submitAttempt(a.userId, a.id, [], a.tabSwitches, a.fullscreenExits);
      break;
    }
    case "reset": {
      // Lets a student start again after a crash. Only before they submit.
      const a = await prisma.attempt.findFirst({ where: { labTestId: t.id, userId: b.userId } });
      if (!a) throw new HttpError(404, "Nothing to reset.");
      if (a.submittedAt) throw new HttpError(409, "This student already submitted. A submitted test cannot be reset.");
      await prisma.attempt.delete({ where: { id: a.id } });
      break;
    }
    case "release": {
      await prisma.labTest.update({ where: { id: t.id }, data: { resultsReleased: true } });
      if (b.notifyStudents) {
        const ids = (await prisma.attempt.findMany({ where: { labTestId: t.id, submittedAt: { not: null } }, select: { userId: true } })).map((x) => x.userId);
        if (ids.length) await notify(ids, `Results: ${t.title}`, "Your lab test result is now available.", ["IN_APP", "EMAIL"], "/results");
      }
      break;
    }
    case "delete":
      if (await prisma.attempt.count({ where: { labTestId: t.id } })) throw new HttpError(409, "Students have already taken this test, so it cannot be deleted.");
      await prisma.labTest.delete({ where: { id: t.id } });
      await audit(u.id, "labtest.delete", t.id);
      return { ok: true };
  }
  await audit(u.id, `labtest.${b.action}`, t.id, b);
  if (b.action === "start") {
    const ids = (await prisma.profile.findMany({ where: rosterWhere(t), select: { userId: true } })).map((p) => p.userId);
    if (ids.length) await notify(ids, `${t.title} has started`, "Enter the access code shown in your lab.", ["IN_APP"], "/mock");
  }
  return { ok: true };
});
