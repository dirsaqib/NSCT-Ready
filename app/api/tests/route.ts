import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { startAttempt } from "@/lib/tests";
import { clientIp } from "@/lib/audit";

const Body = z.object({
  type: z.enum(["DIAGNOSTIC", "MOCK", "MINI_MOCK", "NATIONAL_MOCK", "PRACTICE", "MISTAKES", "EMPLOYER_ASSESSMENT", "LAB_TEST"]),
  subject: z.enum(["PS", "PROG", "DSA", "DB", "SE", "WEB", "AI", "NET", "OS", "SEC"]).optional(),
  topic: z.string().max(60).optional(),
  difficulty: z.number().int().min(1).max(3).optional(),
  count: z.number().int().min(1).max(30).optional(),
  assessmentCode: z.string().max(40).optional(),
  labTestId: z.string().max(40).optional(),
  accessCode: z.string().max(12).optional(),
  seat: z.string().max(20).optional(),
});

export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const b = Body.parse(await req.json());
  return startAttempt(u.id, b, { ip: clientIp(), device: req.headers.get("x-device-id") });
});
