"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useT, LanguageToggle } from "./Locale";
import { api } from "./api";

type Item = [string, string]; // href, label or i18n key
const STUDENT: Item[] = [["/dashboard", "nav.dashboard"], ["/learn", "nav.learn"], ["/diagnostic", "nav.diagnostic"], ["/mock", "nav.mock"], ["/practice", "nav.practice"], ["/plan", "nav.plan"], ["/results", "nav.results"], ["/mistakes", "nav.mistakes"], ["/bookmarks", "nav.bookmarks"], ["/tutor", "nav.tutor"], ["/discuss", "nav.discuss"], ["/leaderboard", "nav.leaderboard"], ["/messages", "nav.messages"], ["/pro", "nav.pro"], ["/profile", "nav.profile"]];
const UNI: Item[] = [["/university", "University dashboard"], ["/students", "Students and verification"], ["/admin/notices", "Announcements"], ["/labtests", "Lab tests (CBT and offline)"], ["/contribute", "Question bank and upload"], ["/discuss", "Answer student doubts"]];
const PANELS: Record<string, { label: string; items: Item[] }[]> = {
  STUDENT: [{ label: "nav.prepare", items: STUDENT }],
  FACULTY: [{ label: "Faculty", items: [["/contribute", "Question bank"], ["/discuss", "Answer student doubts"]] }],
  HOD: [{ label: "Head of department", items: UNI }],
  CAMPUS_ADMIN: [{ label: "Campus admin", items: UNI }],
  FOCAL: [{ label: "Focal person panel", items: UNI }],
  CHAIR: [{ label: "Chair panel", items: UNI }],
  GOV: [{ label: "HEC and government panel", items: [["/gov", "National dashboard"], ["/gov/archive", "Report archive"]] }],
  EMPLOYER: [{ label: "Employer portal", items: [["/employer", "Find talent"]] }],
  SPONSOR: [{ label: "Sponsor portal", items: [["/sponsor", "Impact dashboard"]] }],
  ADMIN: [
    { label: "Super admin panel", items: [["/admin/analytics", "Analytics"], ["/admin/drilldown", "Drill down"], ["/admin/live", "Live activity"], ["/admin/users", "Users and roles"], ["/admin/structure", "Universities and campuses"], ["/university", "University view"], ["/admin/questions", "Question bank"], ["/admin/tests", "Tests and schedule"], ["/labtests", "Lab tests"], ["/contribute", "Upload questions"], ["/admin/content", "Lessons, FAQ, surveys, events"], ["/admin/publish", "HEC reports"], ["/admin/notices", "Announcements"], ["/admin/business", "Business and payments"], ["/admin/support", "Support and re-checks"], ["/admin/audit", "Audit log"], ["/admin/settings", "Settings"]] },
    { label: "Panels preview", items: [["/gov", "HEC view"], ["/employer", "Employer view"], ["/dashboard", "Student view"]] },
  ],
};
const COMMON: Item[] = [["/notifications", "Notifications"], ["/support", "nav.support"], ["/help", "nav.help"], ["/security", "nav.security"]];
const HOME: Record<string, string> = { STUDENT: "/dashboard", FACULTY: "/contribute", HOD: "/university", CAMPUS_ADMIN: "/university", FOCAL: "/university", CHAIR: "/university", GOV: "/gov", EMPLOYER: "/employer", SPONSOR: "/sponsor", ADMIN: "/admin/analytics" };

export default function Nav({ role }: { role: string }) {
  const p = usePathname();
  const r = useRouter();
  const { t } = useT();
  const [unread, setUnread] = useState(0);
  const panels = PANELS[role] ?? PANELS.STUDENT;
  const allowed = [...panels.flatMap((x) => x.items.map((i) => i[0])), ...COMMON.map((c) => c[0]), ...(role === "STUDENT" || role === "ADMIN" ? ["/test", "/register"] : [])];
  useEffect(() => {
    if (!allowed.some((a) => p === a || p.startsWith(a + "/"))) r.replace(HOME[role] ?? "/dashboard");
  }, [p, role]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const f = () => api<{ unread: number }>("/api/notifications").then((x) => setUnread(x.unread)).catch(() => {});
    f(); const id = setInterval(f, 60000); return () => clearInterval(id);
  }, []);
  const link = ([href, label]: Item) => (
    <Link key={href} href={href} className={p === href || p.startsWith(href + "/") ? "on" : ""}>
      {t(label)}{href === "/notifications" && unread > 0 && <span className="pill warn" style={{ marginInlineStart: "auto" }}>{unread}</span>}
    </Link>
  );
  return (
    <nav className="nav">
      {panels.map((g) => <div key={g.label}><div className="nav-label">{t(g.label)}</div>{g.items.map(link)}</div>)}
      <div className="nav-label">Account</div>
      {COMMON.map(link)}
      <div className="row" style={{ padding: "10px 8px" }}><LanguageToggle /><button className="btn sm sec" onClick={() => signOut({ callbackUrl: "/" })}>{t("common.signout")}</button></div>
    </nav>
  );
}
