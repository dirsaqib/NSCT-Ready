"use client";

export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(path, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || "Something went wrong.");
  return data as T;
}

export const SUBJECT_SHORT: Record<string, string> = {
  PS: "Problem Solving", PROG: "Programming", DSA: "DSA", DB: "Databases", SE: "Software Eng.",
  WEB: "Web Dev", AI: "AI/ML", NET: "Networks & Cloud", OS: "OS", SEC: "Cyber Security",
};

export const fmtTime = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;
