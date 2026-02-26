import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const jobType = searchParams.get("job_type");
  const status = searchParams.get("status");
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));

  let query = supabase
    .from("cron_job_runs")
    .select("id, job_type, started_at, finished_at, status, summary, error_message")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (jobType && ["daily_interest", "auto_withdrawal"].includes(jobType)) {
    query = query.eq("job_type", jobType);
  }
  if (status && ["success", "failed", "partial"].includes(status)) {
    query = query.eq("status", status);
  }

  const { data: runs, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (runs ?? []).map((r) => ({
    id: r.id,
    jobType: r.job_type,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    status: r.status,
    summary: r.summary,
    errorMessage: r.error_message,
  }));

  return NextResponse.json({ runs: list });
}
