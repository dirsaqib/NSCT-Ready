export const dynamic = "force-dynamic";
import { z } from "zod";
import { handle } from "@/lib/http";
import { issueOtp } from "@/lib/otp";

/** Step 1 of phone sign-in: send a 6 digit code by SMS. Step 2 is signIn("phone", { phone, code }). */
export const POST = handle(async (req: Request) => {
  const { phone } = z.object({ phone: z.string().min(10).max(20) }).parse(await req.json());
  return issueOtp(phone);
});
