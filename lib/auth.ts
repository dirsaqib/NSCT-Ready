// Sign-in: Google, email magic link, or phone number with a one-time SMS code.
// Staff roles must also pass a second factor (authenticator app) before they can use their panel.
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import { verifyOtp } from "./otp";
import { verifyTotp } from "./totp";
import { decrypt } from "./crypto";
import { HttpError } from "./errors";

export { HttpError };

/** Roles that must use two-factor authentication. */
export const TWO_FACTOR_ROLES: Role[] = ["HOD", "CAMPUS_ADMIN", "FOCAL", "CHAIR", "GOV", "ADMIN"];

export const authOptions: NextAuthOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt", maxAge: 7 * 24 * 3600 },
  providers: [
    GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID ?? "", clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "" }),
    EmailProvider({ server: process.env.EMAIL_SERVER, from: process.env.EMAIL_FROM }),
    CredentialsProvider({
      id: "phone",
      name: "Phone",
      credentials: { phone: { type: "text" }, code: { type: "text" } },
      async authorize(c) {
        if (!c?.phone || !c?.code) return null;
        const phone = await verifyOtp(c.phone, c.code);
        if (!phone) return null;
        const user = await prisma.user.upsert({ where: { phone }, create: { phone, phoneVerified: new Date() }, update: { phoneVerified: new Date() } });
        if (user.status === "BLOCKED") return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  pages: { signIn: "/signin" },
  callbacks: {
    async signIn({ user }) {
      const u = await prisma.user.findUnique({ where: { id: user.id }, select: { status: true, lockedUntil: true } });
      if (u?.status === "BLOCKED") return false;
      if (u?.lockedUntil && u.lockedUntil > new Date()) return false;
      return true;
    },
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
        select: { role: true, status: true, universityId: true, campusId: true, departmentId: true, employerId: true, sponsorId: true, totpEnabled: true, locale: true },
      });
      if (db) Object.assign(token, db);
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user, id: token.uid, role: token.role, status: token.status, universityId: token.universityId, campusId: token.campusId,
          departmentId: token.departmentId, employerId: token.employerId, sponsorId: token.sponsorId, totpEnabled: token.totpEnabled, tfa: !!token.tfa, locale: token.locale,
        },
      };
    },
  },
};

export type SessionUser = {
  id: string; role: Role; status: string; email?: string | null;
  universityId: string | null; campusId: string | null; departmentId: string | null;
  employerId: string | null; sponsorId: string | null; totpEnabled: boolean; tfa: boolean; locale: string;
};

export async function currentUser(): Promise<SessionUser | null> {
  const s = await getServerSession(authOptions);
  return (s?.user as SessionUser) ?? null;
}

export async function requireUser(opts: { allowWithout2fa?: boolean } = {}): Promise<SessionUser> {
  const u = await currentUser();
  if (!u?.id) throw new HttpError(401, "Please sign in.");
  if (u.status === "BLOCKED") throw new HttpError(403, "Your account is blocked. Contact support.");
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
