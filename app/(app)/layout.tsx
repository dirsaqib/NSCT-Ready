import { redirect } from "next/navigation";
import { currentUser, TWO_FACTOR_ROLES } from "@/lib/auth";
import Nav from "@/components/Nav";
import Providers from "@/components/Providers";
import { LocaleProvider } from "@/components/Locale";
import TwoFactorGate from "@/components/TwoFactorGate";
import { getSetting } from "@/lib/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  if (!u?.id) redirect("/signin");
  if (u.status === "BLOCKED") redirect("/help?blocked=1");
  const needs2fa = TWO_FACTOR_ROLES.includes(u.role) && (!u.totpEnabled || !u.tfa);
  const brand = await getSetting<string>("branding.name");
  return (
    <Providers>
      <LocaleProvider initial={(u.locale as "en" | "ur") ?? "en"}>
        <div className="app">
          <aside className="side">
            <div className="logo">
              <div className="logo-mark">NR</div>
              <div><b>{brand}</b><small>Free prep for NSCT 2027</small></div>
            </div>
            {!needs2fa && <Nav role={u.role} />}
            <div className="side-foot">Independent and free. Not affiliated with HEC, VU, PSEB or P@SHA.</div>
          </aside>
          <main>
            {needs2fa ? <TwoFactorGate setup={!u.totpEnabled} /> : children}
            <footer className="disc">
              Readiness scores are estimates based on your practice, not official NSCT results. <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/help">Help</a>
            </footer>
          </main>
        </div>
      </LocaleProvider>
    </Providers>
  );
}
