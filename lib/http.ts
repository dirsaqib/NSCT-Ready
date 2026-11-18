import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./errors";
import { prisma } from "./db";

/** Save a server error for the super admin logs page. Never throws. */
export async function logError(e: unknown, req?: unknown) {
  try {
    const r = req instanceof Request ? req : null;
    const err = e instanceof Error ? e : new Error(String(e));
    await prisma.errorLog.create({ data: { path: r ? new URL(r.url).pathname : "unknown", method: r?.method ?? "", message: err.message.slice(0, 1000), stack: err.stack?.slice(0, 4000) ?? null } });
  } catch { /* the database itself may be the problem */ }
}

/** Wrap a route handler so errors become clean JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const data = await fn(...args);
      if (data instanceof Response) return data;
      return NextResponse.json(data ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: "Please check the form and try again.", issues: e.issues }, { status: 400 });
      console.error(e);
      await logError(e, args[0]);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }
  };
}
