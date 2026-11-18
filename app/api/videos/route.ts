export const dynamic = "force-dynamic";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRole, HttpError } from "@/lib/auth";
import { handle } from "@/lib/http";
import { audit } from "@/lib/audit";

/** Study material videos, optionally for one subject. */
export const GET = handle(async (req: Request) => {
  await requireUser();
  const subject = new URL(req.url).searchParams.get("subject");
  return { videos: await prisma.studyVideo.findMany({ where: subject ? { subject: subject as never } : {}, orderBy: [{ subject: "asc" }, { order: "asc" }, { createdAt: "asc" }] }) };
});

const SUBJECT = z.enum(["PS", "PROG", "DSA", "DB", "SE", "WEB", "AI", "NET", "OS", "SEC"]);

/** Read a YouTube link: a video id, a playlist id and a start time. */
function parseYouTube(url: string) {
  const u = new URL(url);
  if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname)) throw new HttpError(400, "Paste a YouTube link.");
  const id = u.hostname.endsWith("youtu.be") ? u.pathname.slice(1, 12) : u.searchParams.get("v") ?? (u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1] ?? null);
  const playlist = u.searchParams.get("list");
  const t = u.searchParams.get("t") ?? u.searchParams.get("start");
  const startSec = t ? (/^\d+$/.test(t) ? Number(t) : Number(t.match(/(\d+)h/)?.[1] ?? 0) * 3600 + Number(t.match(/(\d+)m/)?.[1] ?? 0) * 60 + Number(t.match(/(\d+)s/)?.[1] ?? 0)) : 0;
  if (!id && !playlist) throw new HttpError(400, "That link has no video or playlist in it.");
  return { youtubeId: id && /^[\w-]{11}$/.test(id) ? id : null, playlist: playlist && /^[\w-]{10,64}$/.test(playlist) ? playlist : null, startSec };
}

/** Super admin: add or remove a video. */
export const POST = handle(async (req: Request) => {
  const u = await requireRole("ADMIN");
  const b = z.object({ subject: SUBJECT, title: z.string().min(3).max(150), channel: z.string().min(2).max(80), url: z.string().url(), order: z.number().int().min(0).max(999).default(0) }).parse(await req.json());
  const v = await prisma.studyVideo.create({ data: { subject: b.subject, title: b.title, channel: b.channel, order: b.order, ...parseYouTube(b.url) } });
  await audit(u.id, "video.add", v.id);
  return { video: v };
});

export const DELETE = handle(async (req: Request) => {
  const u = await requireRole("ADMIN");
  const { id } = z.object({ id: z.string() }).parse(await req.json());
  await prisma.studyVideo.delete({ where: { id } });
  await audit(u.id, "video.delete", id);
  return { ok: true };
});
