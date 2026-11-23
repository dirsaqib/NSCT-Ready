"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useT, LanguageToggle } from "./Locale";
import { api } from "./api";
import SimFusionMark from "./SimFusionMark";

type Item = [string, string]; // href, label or i18n key
// Kept short on purpose: each role sees only what it needs. Other pages stay reachable from inside these.
const STUDENT: Item[] = [["/dashboard", "Home"], ["/prepare", "Preparation"], ["/mock", "Mock tests"], ["/learn", "Study materials"], ["/results", "My results"], ["/profile", "nav.profile"]];
const UNI: Item[] = [["/university", "Dashboard"], ["/students", "Students"], ["/contribute", "Question bank"], ["/departments", "Departments"]];
// Pages that are not in the menu but are opened from buttons inside it.
const HIDDEN: Record<string, string[]> = {
  STUDENT: ["/test", "/register", "/tutor", "/mistakes", "/bookmarks", "/practice", "/plan", "/diagnostic", "/discuss", "/leaderboard", "/messages", "/pro"],
  FOCAL: ["/admin/notices", "/labtests", "/discuss"],
  ADMIN: ["/test", "/register", "/prepare", "/mock", "/learn", "/results"],
};
const PANELS: Record<string, { label: string; items: Item[] }[]> = {
  STUDENT: [{ label: "My NSCT", items: STUDENT }],
  FACULTY: [{ label: "Faculty", items: [["/contribute", "Question bank"], ["/discuss", "Answer student doubts"]] }],
  HOD: [{ label: "Head of department", items: UNI }],
  CAMPUS_ADMIN: [{ label: "Campus admin", items: UNI }],
  FOCAL: [{ label: "Focal person", items: UNI }],
  CHAIR: [{ label: "Chair panel", items: UNI }],
  GOV: [{ label: "Government panel", items: [["/gov", "National dashboard"], ["/gov/archive", "Report archive"]] }],
  EMPLOYER: [{ label: "Employer portal", items: [["/employer", "Find talent"]] }],
  SPONSOR: [{ label: "Sponsor portal", items: [["/sponsor", "Impact dashboard"]] }],
  ADMIN: [
    { label: "Super admin panel", items: [["/admin/analytics", "Analytics"], ["/admin/approvals", "Focal person approvals"], ["/admin/users", "Users and passwords"], ["/students", "All students"], ["/admin/logs", "System logs"], ["/admin/messages", "Website chat messages"], ["/admin/audit", "Audit log"], ["/admin/drilldown", "Drill down"], ["/admin/live", "Live activity"], ["/admin/structure", "Universities and campuses"], ["/university", "University view"], ["/admin/questions", "Question bank"], ["/admin/generate", "AI question generator"], ["/admin/videos", "Study videos"], ["/admin/tests", "Tests and schedule"], ["/labtests", "Lab tests"], ["/contribute", "Upload questions"], ["/admin/content", "Lessons, FAQ, surveys, events"], ["/admin/notices", "Announcements"], ["/admin/business", "Business and payments"], ["/admin/support", "Support and re-checks"], ["/admin/settings", "Settings"]] },
    { label: "Preview", items: [["/dashboard", "Student view"]] },
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
  const allowed = [...panels.flatMap((x) => x.items.map((i) => i[0])), ...COMMON.map((c) => c[0]), ...(HIDDEN[role] ?? (["HOD", "CAMPUS_ADMIN", "CHAIR"].includes(role) ? HIDDEN.FOCAL : []))];
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
      <div style={{ padding: "8px" }}><SimFusionMark /></div>
      <div className="row" style={{ padding: "10px 8px" }}><LanguageToggle /><button className="btn sm sec" onClick={() => signOut({ callbackUrl: "/" })}>{t("common.signout")}</button></div>
    </nav>
  );
}
