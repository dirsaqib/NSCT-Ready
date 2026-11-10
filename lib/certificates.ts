// Certificates with a QR code that links to a public verification page.
import QRCode from "qrcode";
import { prisma } from "./db";
import { publicCode } from "./crypto";
import { HttpError } from "./errors";
import { getSetting } from "./settings";

const ELIGIBLE = ["MOCK", "NATIONAL_MOCK", "DIAGNOSTIC", "EMPLOYER_ASSESSMENT"];

export async function issueCertificate(userId: string, attemptId: string) {
  const a = await prisma.attempt.findFirst({ where: { id: attemptId, userId }, include: { certificate: true, user: { select: { universityId: true } } } });
  if (!a || !a.submittedAt) throw new HttpError(404, "Submitted test not found.");
  if (!ELIGIBLE.includes(a.type) || a.label) throw new HttpError(400, "Certificates are issued for full diagnostic and mock tests.");
  if (a.flags.length) throw new HttpError(400, "This test is under integrity review. A certificate can be issued after review.");
  if (a.certificate) return a.certificate;
  const sponsor = a.user.universityId ? await prisma.sponsorship.findFirst({ where: { universityId: a.user.universityId, brandOnCertificates: true, endsAt: { gt: new Date() } } }) : null;
  return prisma.certificate.create({ data: { code: publicCode(), userId, attemptId, score: a.score, sponsorId: sponsor?.sponsorId } });
}

export const verifyUrl = (code: string) => `${process.env.NEXTAUTH_URL}/verify/${code}`;

export async function qrSvg(code: string) {
  return QRCode.toString(verifyUrl(code), { type: "svg", margin: 1, width: 160, color: { dark: "#0A3D2E", light: "#FFFFFF" } });
}

/** Public data shown on the verification page and returned by the employer API. */
export async function verifyCertificate(code: string) {
  const c = await prisma.certificate.findUnique({
    where: { code },
    include: {
      user: { select: { profile: { select: { fullName: true, program: true, university: { select: { name: true } } } } } },
      attempt: { select: { type: true, submittedAt: true, percentile: true, items: { select: { correct: true, question: { select: { subject: true } } } } } },
    },
  });
  if (!c) return null;
  const by: Record<string, [number, number]> = {};
  c.attempt.items.forEach((i) => { const b = (by[i.question.subject] ??= [0, 0]); b[1]++; if (i.correct) b[0]++; });
  return {
    valid: !c.revoked,
    code: c.code,
    name: c.user.profile?.fullName,
    university: c.user.profile?.university.name,
    program: c.user.profile?.program,
    test: c.attempt.type,
    score: c.score,
    percentile: c.attempt.percentile,
    bySubject: Object.fromEntries(Object.entries(by).map(([k, [r, t]]) => [k, Math.round((100 * r) / t)])),
    issuedAt: c.issuedAt,
    issuer: await getSetting<string>("branding.name"),
  };
}
