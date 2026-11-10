import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Public help centre. */
export default async function Help({ searchParams }: { searchParams: { blocked?: string } }) {
  const faqs = await prisma.faq.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] });
  const email = await getSetting<string>("content.helpEmail");
  const cats = [...new Set(faqs.map((f) => f.category))];
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 20px" }}>
      <h1>Help centre</h1>
      {searchParams.blocked && <div className="notice bad" style={{ marginBottom: 16 }}>Your account is blocked. Email {email} if you think this is a mistake.</div>}
      <p className="muted">Answers to common questions. Still stuck? <Link href="/support">Open a support ticket</Link> or email {email}.</p>
      {cats.map((c) => (
        <div className="card" key={c} style={{ marginBottom: 14 }}>
          <h2>{c}</h2>
          {faqs.filter((f) => f.category === c).map((f) => (
            <details key={f.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>{f.question}</summary>
              <p className="small" style={{ whiteSpace: "pre-wrap" }}>{f.answer}</p>
            </details>
          ))}
        </div>
      ))}
      <p className="small"><Link href="/terms">Terms of use</Link> · <Link href="/privacy">Privacy policy</Link></p>
    </main>
  );
}
