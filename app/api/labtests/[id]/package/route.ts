import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { buildPackage, labTestForStaff } from "@/lib/labtests";

/**
 * Downloads the encrypted package for the offline lab server. The passphrase is not stored anywhere:
 * the invigilator types it on the lab server on exam day, so a copied file is useless without it.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const u = await requireRole("HOD");
    const t = await labTestForStaff(u, params.id);
    if (t.mode !== "OFFLINE_LAN") throw new HttpError(409, "Only offline tests have a lab server package.");
    const { passphrase } = z.object({ passphrase: z.string().min(8).max(200) }).parse(await req.json());
    const pkg = await buildPackage(t, passphrase);
    await audit(u.id, "labtest.package", t.id);
    const name = t.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "lab-test";
    return new Response(JSON.stringify(pkg), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${name}.nsctlab"` } });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : e instanceof z.ZodError ? 400 : 500;
    return Response.json({ error: e instanceof HttpError ? e.message : e instanceof z.ZodError ? "Use a passphrase of at least 8 characters." : "Could not build the package." }, { status });
  }
}
