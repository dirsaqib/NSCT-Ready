import { verifyCertificate } from "@/lib/certificates";
import { SUBJECTS } from "@/lib/syllabus";

export const dynamic = "force-dynamic";

/** Public certificate verification page opened from the QR code. */
export default async function Verify({ params }: { params: { code: string } }) {
  const c = await verifyCertificate(params.code.toUpperCase());
  return (
    <main className="loading-screen">
      <div className="card" style={{ maxWidth: 520, width: "100%" }}>
        {!c ? (
          <><h1>Certificate not found</h1><p className="muted">Check the code and try again.</p></>
        ) : (
          <>
            <span className={`pill ${c.valid ? "" : "bad"}`}>{c.valid ? "Valid certificate" : "Revoked"}</span>
            <h1 style={{ marginTop: 10 }}>{c.name}</h1>
            <p className="sub">{c.program} · {c.university}</p>
            <div className="grid g2" style={{ margin: "16px 0" }}>
              <div className="stat"><div className="k">Score</div><div className="v">{c.score}%</div></div>
              <div className="stat"><div className="k">Percentile</div><div className="v">{c.percentile ?? "n/a"}</div></div>
            </div>
            <table><tbody>{Object.entries(c.bySubject).map(([k, v]) => <tr key={k}><td>{SUBJECTS.find((s) => s.key === k)?.name ?? k}</td><td><b>{v}%</b></td></tr>)}</tbody></table>
            <p className="tiny muted" style={{ marginTop: 14 }}>Code {c.code} · {c.test.replace("_", " ").toLowerCase()} · issued {new Date(c.issuedAt).toLocaleDateString("en-GB")} by {c.issuer}. A practice platform result, not an official HEC NSCT result.</p>
          </>
        )}
      </div>
    </main>
  );
}
