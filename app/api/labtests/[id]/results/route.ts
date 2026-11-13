import { requireRole } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";
import { importResults, labTestForStaff } from "@/lib/labtests";

/** Upload the signed results file exported by the offline lab server. */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const u = await requireRole("HOD");
  const t = await labTestForStaff(u, params.id);
  if (t.mode !== "OFFLINE_LAN") throw new HttpError(409, "Results files are only for offline tests.");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose the results file from the lab server.");
  let json: unknown;
  try { json = JSON.parse(await file.text()); } catch { throw new HttpError(400, "This is not a lab server results file."); }
  const r = await importResults(t, json);
  await audit(u.id, "labtest.import", t.id, { imported: r.imported, skipped: r.skipped.length });
  return r;
});
