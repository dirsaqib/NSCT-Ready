// Edge middleware: rate limits and security headers. Cloudflare in front adds DDoS protection and a
// shared rate limit across instances. This in-memory limit protects each instance on its own.
import { NextResponse, type NextRequest } from "next/server";

const buckets = new Map<string, { n: number; reset: number }>();
const LIMITS: [RegExp, number][] = [
  [/^\/api\/auth\/otp/, 5],        // OTP requests per minute per IP
  [/^\/api\/auth\//, 30],
  [/^\/api\/ai\//, 20],
  [/^\/api\/payments\//, 10],
  [/^\/api\//, 240],
];

// One address for everyone. Sign-in cookies are tied to a domain, so starting on a Vercel preview
// address and returning on the main one breaks Google sign-in. Production sends every *.vercel.app
// alias to the address in NEXTAUTH_URL.
const CANONICAL = (() => { try { return new URL(process.env.NEXTAUTH_URL ?? "").host; } catch { return ""; } })();

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const host = req.headers.get("host") ?? "";
  if (process.env.VERCEL_ENV === "production" && CANONICAL && host !== CANONICAL && host.endsWith(".vercel.app") && !path.startsWith("/api/cron")) {
    const to = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${CANONICAL}`);
    return NextResponse.redirect(to, 308);
  }
  const rule = LIMITS.find(([re]) => re.test(path));
  if (rule) {
    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "local";
    const key = `${rule[0].source}:${ip}`;
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.reset < now) buckets.set(key, { n: 1, reset: now + 60000 });
    else if (++b.n > rule[1]) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    if (buckets.size > 50000) buckets.clear();
  }
  const res = NextResponse.next();
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
