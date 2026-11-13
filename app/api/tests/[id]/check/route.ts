export const dynamic = "force-dynamic";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { checkPracticeAnswer, AnswerSchema as Answer } from "@/lib/tests";

export const POST = handle(async (req: Request, ctx: { params: { id: string } }) => {
  const u = await requireUser();
  return checkPracticeAnswer(u.id, ctx.params.id, Answer.parse(await req.json()));
});
