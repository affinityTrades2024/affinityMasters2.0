import { NextRequest, NextResponse } from "next/server";
import { runDailyInterestForDate } from "@/lib/interest";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") 
    || request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const forDate = yesterday.toISOString().slice(0, 10);
  try {
    const result = await runDailyInterestForDate(forDate);
    return NextResponse.json({
      ok: true,
      forDate,
      credited: result.credited,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (e) {
    console.error("Daily interest job failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Job failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
