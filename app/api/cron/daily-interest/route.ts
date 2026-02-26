import { NextRequest, NextResponse } from "next/server";
import { runDailyInterestForDate } from "@/lib/interest";
import { recordCronJobRun } from "@/lib/cron-job-runs";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const startedAt = new Date().toISOString();
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const forDate = yesterday.toISOString().slice(0, 10);
  try {
    const result = await runDailyInterestForDate(forDate);
    const finishedAt = new Date().toISOString();
    const status = result.errors.length > 0 ? (result.credited > 0 ? "partial" : "failed") : "success";
    await recordCronJobRun({
      job_type: "daily_interest",
      started_at: startedAt,
      finished_at: finishedAt,
      status,
      summary: {
        forDate,
        credited: result.credited,
        skipped: result.skipped,
        errorCount: result.errors.length,
      },
      error_message:
        result.errors.length > 0 ? result.errors.slice(0, 3).join("; ") : null,
    });
    return NextResponse.json({
      ok: true,
      forDate,
      credited: result.credited,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (e) {
    const finishedAt = new Date().toISOString();
    const errMsg = e instanceof Error ? e.message : "Job failed";
    await recordCronJobRun({
      job_type: "daily_interest",
      started_at: startedAt,
      finished_at: finishedAt,
      status: "failed",
      summary: { forDate },
      error_message: errMsg,
    });
    console.error("Daily interest job failed", e);
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
