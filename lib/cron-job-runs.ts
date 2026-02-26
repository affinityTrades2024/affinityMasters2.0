import { supabase } from "@/lib/supabase/server";

export type CronJobType = "daily_interest" | "auto_withdrawal";
export type CronJobStatus = "success" | "failed" | "partial";

export interface CronJobRunInsert {
  job_type: CronJobType;
  started_at: string;
  finished_at: string;
  status: CronJobStatus;
  summary?: Record<string, number | string>;
  error_message?: string | null;
}

/**
 * Record a completed cron job run for admin visibility.
 */
export async function recordCronJobRun(insert: CronJobRunInsert): Promise<void> {
  await supabase.from("cron_job_runs").insert({
    job_type: insert.job_type,
    started_at: insert.started_at,
    finished_at: insert.finished_at,
    status: insert.status,
    summary: insert.summary ?? null,
    error_message: insert.error_message ?? null,
  });
}
