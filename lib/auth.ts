// Sign-in with a password only. Students use university plus roll number (or email), staff use email.
// Staff roles must also pass a second factor (authenticator app) before they can use their panel.
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import { verifyTotp } from "./totp";
import { decrypt } from "./crypto";
import { HttpError } from "./errors";
import { verifyPassword } from "./password";
import { audit } from "./audit";

export { HttpError };

/** Roles that must use two-factor authentication. */
export const TWO_FACTOR_ROLES: Role[] = ["HOD", "CAMPUS_ADMIN", "FOCAL", "CHAIR", "GOV", "ADMIN"];

/** Find the account for a login: email, or university plus roll number. */
async function findLogin(login: string, universityId?: string) {
  const l = login.trim();
  if (l.includes("@")) return prisma.user.findUnique({ where: { email: l.toLowerCase() }, omit: { passwordHash: false } });
  if (!universityId) return null;
  const p = await prisma.profile.findUnique({ where: { universityId_rollNumber: { universityId, rollNumber: l } }, select: { userId: true } });
  return p ? prisma.user.findUnique({ where: { id: p.userId }, omit: { passwordHash: false } }) : null;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 7 * 24 * 3600 },
  providers: [
    CredentialsProvider({
      id: "password",
      name: "Password",
      credentials: { login: { type: "text" }, universityId: { type: "text" }, password: { type: "password" } },
      async authorize(c) {
        if (!c?.login || !c?.password) return null;
        const user = await findLogin(c.login, c.universityId || undefined);
        if (!user) return null;
        if (user.lockedUntil && user.lockedUntil > new Date()) throw new Error("LOCKED");
        if (!verifyPassword(c.password, user.passwordHash)) {
          const fails = user.failedLogins + 1;
          await prisma.user.update({ where: { id: user.id }, data: { failedLogins: fails, lockedUntil: fails >= 5 ? new Date(Date.now() + 15 * 60000) : undefined } });
          await audit(user.id, "signin.fail").catch(() => {});
          return null;
        }
        if (user.status === "BLOCKED") throw new Error("BLOCKED");
        if (user.role !== "STUDENT" && user.status === "PENDING") throw new Error("PENDING_APPROVAL");
        await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastSeenAt: new Date() } });
        await audit(user.id, "signin.ok").catch(() => {});
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  pages: { signIn: "/signin" },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) token.uid = user.id;
      if (!token.uid) return token;
      // The second factor is checked when the client calls update({ totp: "123456" }).
      if (trigger === "update" && session?.totp) {
        const u = await prisma.user.findUnique({ where: { id: token.uid as string }, select: { totpSecret: true, totpEnabled: true, failedLogins: true, lockedUntil: true } });
        const locked = u?.lockedUntil && u.lockedUntil > new Date();
        if (!locked && u?.totpEnabled && u.totpSecret && verifyTotp(decrypt(u.totpSecret), String(session.totp))) {
          token.tfa = true;
          await prisma.user.update({ where: { id: token.uid as string }, data: { failedLogins: 0 } });
        } else {
          const fails = (u?.failedLogins ?? 0) + 1;
          await prisma.user.update({ where: { id: token.uid as string }, data: { failedLogins: fails, lockedUntil: fails >= 5 ? new Date(Date.now() + 15 * 60000) : undefined } });
        }
      }
      const db = await prisma.user.findUnique({
        where: { id: token.uid as string },
        select: { role: true, status: true, universityId: true, campusId: true, departmentId: true, employerId: true, sponsorId: true, totpEnabled: true, locale: true, mustChangePassword: true },
      });
      if (db) Object.assign(token, db);
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user, id: token.uid, role: token.role, status: token.status, universityId: token.universityId, campusId: token.campusId,
          departmentId: token.departmentId, employerId: token.employerId, sponsorId: token.sponsorId, totpEnabled: token.totpEnabled, tfa: !!token.tfa, locale: token.locale, mustChangePassword: !!token.mustChangePassword,
        },
      };
    },
  },
};

export type SessionUser = {
  id: string; role: Role; status: string; email?: string | null;
  universityId: string | null; campusId: string | null; departmentId: string | null;
  employerId: string | null; sponsorId: string | null; totpEnabled: boolean; tfa: boolean; locale: string; mustChangePassword?: boolean;
};

export async function currentUser(): Promise<SessionUser | null> {
  const s = await getServerSession(authOptions);
  return (s?.user as SessionUser) ?? null;
}

export async function requireUser(opts: { allowWithout2fa?: boolean; allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const u = await currentUser();
  if (!u?.id) throw new HttpError(401, "Please sign in.");
  if (u.status === "BLOCKED") throw new HttpError(403, "Your account is blocked. Contact support.");
  if (u.role !== "STUDENT" && u.status === "PENDING") throw new HttpError(403, "Your registration is waiting for approval by the NSCT super admin.", "PENDING_APPROVAL");
  if (!opts.allowPasswordChange && u.mustChangePassword) throw new HttpError(403, "Please set a new password to continue.", "PASSWORD_CHANGE");
  if (!opts.allowWithout2fa && TWO_FACTOR_ROLES.includes(u.role)) {
    if (!u.totpEnabled) throw new HttpError(403, "Set up two-factor authentication to continue.", "2FA_SETUP");
    if (!u.tfa) throw new HttpError(403, "Enter your authenticator code to continue.", "2FA_REQUIRED");
  }
  prisma.user.update({ where: { id: u.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  return u;
}

// University ladder. GOV, EMPLOYER and SPONSOR sit outside it and never see student records.
const RANK: Record<Role, number> = { STUDENT: 0, GOV: -1, EMPLOYER: -1, SPONSOR: -1, FACULTY: 1, HOD: 2, CAMPUS_ADMIN: 3, FOCAL: 4, CHAIR: 4, ADMIN: 9 };

export async function requireRole(min: Role): Promise<SessionUser> {
  const u = await requireUser();
  if (RANK[u.role] < RANK[min]) throw new HttpError(403, "You do not have access to this.");
  return u;
}

export async function requireAnyRole(roles: Role[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw new HttpError(403, "You do not have access to this.");
  return u;
}

/** Staff can only see their own part of the hierarchy. Returns a Prisma filter for Profile. */
export function profileScope(u: SessionUser, requestedUniversityId?: string | null): { universityId?: string; campusId?: string; departmentId?: string } {
  if (u.role === "ADMIN") return requestedUniversityId ? { universityId: requestedUniversityId } : {};
  if (!u.universityId) throw new HttpError(403, "Your account is not linked to a university.");
  if (u.role === "HOD") {
    if (!u.departmentId) throw new HttpError(403, "Your account is not linked to a department.");
    return { universityId: u.universityId, departmentId: u.departmentId };
  }
  if (u.role === "CAMPUS_ADMIN") {
    if (!u.campusId) throw new HttpError(403, "Your account is not linked to a campus.");
    return { universityId: u.universityId, campusId: u.campusId };
  }
  return { universityId: u.universityId };
}

/** Kept for older routes. */
export function universityScope(u: SessionUser, requested?: string | null): string | null {
  if (u.role === "ADMIN") return requested || null;
  if (!u.universityId) throw new HttpError(403, "Your account is not linked to a university.");
  return u.universityId;
}

export const HOME: Record<Role, string> = {
  STUDENT: "/dashboard", FACULTY: "/contribute", HOD: "/university", CAMPUS_ADMIN: "/university", FOCAL: "/university", CHAIR: "/university",
  GOV: "/gov", EMPLOYER: "/employer", SPONSOR: "/sponsor", ADMIN: "/admin/analytics",
};
