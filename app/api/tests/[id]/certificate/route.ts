import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { issueCertificate, qrSvg, verifyUrl } from "@/lib/certificates";

export const POST = handle(async (_req: Request, ctx: { params: { id: string } }) => {
  const u = await requireUser();
  const c = await issueCertificate(u.id, ctx.params.id);
  return { code: c.code, url: verifyUrl(c.code), qr: await qrSvg(c.code) };
});
