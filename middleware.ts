// Edge middleware: rate limits and security headers. Cloudflare in front adds DDoS protection and a
// shared rate limit across instances. This in-memory limit protects each instance on its own.
import { NextResponse, type NextRequest } from "next/server";

const buckets = new Map<string, { n: number; reset: number }>();
// A whole university lab often shares one public IP, so limits are counted per signed-in browser where
// possible and per IP only for anonymous requests. Account lockout separately stops password guessing.
const LIMITS: [RegExp, number, "ip" | "user"][] = [
  [/^\/api\/signup\//, 300, "ip"],      // registrations per minute per IP: a lab of 200 can register together
  [/^\/api\/auth\//, 1200, "ip"],       // sign-ins and session checks per minute per IP
  [/^\/api\/ai\//, 20, "user"],
  [/^\/api\/payments\//, 10, "user"],
  [/^\/api\//, 300, "user"],            // per student per minute; autosave uses about 4
];

// Optional single address. Only active when CANONICAL_HOST is set (for example tayarihub.vercel.app).
// Domain redirects are better done in Vercel Domains, so this stays off by default.
const CANONICAL = (process.env.CANONICAL_HOST ?? "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");

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
    const session = req.cookies.get("__Secure-next-auth.session-token")?.value ?? req.cookies.get("next-auth.session-token")?.value;
    const who = rule[2] === "user" && session ? `s:${session.slice(-24)}` : `ip:${ip}`;
    const key = `${rule[0].source}:${who}`;
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
