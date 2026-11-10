import { NextResponse } from "next/server";
import { processQueue } from "@/lib/notify";

/** Called every minute by Cloud Scheduler (or any cron) with header Authorization: Bearer CRON_SECRET. */
export async function POST(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await processQueue(500));
}
