import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { getFundsRates } from "@/lib/funds-rates";
import { createNotification } from "@/lib/notifications";
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
  let processed = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  try {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, investment_account_id")
      .eq("auto_withdrawal_enabled", true)
      .not("investment_account_id", "is", null);

    const clientList = clients ?? [];
    const rates = await getFundsRates();
    const rateUsed = rates.withdrawalInrPerUsd;

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;

    for (const client of clientList) {
      const clientId = client.id as number;
      const accountId = client.investment_account_id as number;
      processed++;

      try {
        const { data: accountRow } = await supabase
          .from("accounts")
          .select("account_id, balance")
          .eq("account_id", accountId)
          .eq("client_id", clientId)
          .not("platform", "ilike", "%demo%")
          .maybeSingle();

        if (!accountRow) {
          skipped++;
          continue;
        }

        const balance = Number(accountRow.balance ?? 0);
        if (balance <= 0) {
          skipped++;
          continue;
        }

        const { data: bankRow } = await supabase
          .from("bank_accounts")
          .select("id")
          .eq("client_id", clientId)
          .eq("is_default", true)
          .maybeSingle();

        if (!bankRow) {
          skipped++;
          continue;
        }

        const { data: existingList } = await supabase
          .from("funds_requests")
          .select("id")
          .eq("client_id", clientId)
          .eq("is_auto_withdrawal", true)
          .gte("requested_at", firstOfMonth)
          .limit(1);

        if (existingList && existingList.length > 0) {
          skipped++;
          continue;
        }

        const amountUsd = balance;
        const amountInr = Math.round(amountUsd * rateUsed * 100) / 100;

        const insertPayload: Record<string, unknown> = {
          client_id: clientId,
          type: "withdrawal",
          account_id: accountId,
          bank_account_id: bankRow.id,
          amount_usd: amountUsd,
          amount_inr: amountInr,
          rate_used: rateUsed,
          status: "pending",
          is_auto_withdrawal: true,
        };

        const { data: inserted, error: insertError } = await supabase
          .from("funds_requests")
          .insert(insertPayload)
          .select("id")
          .single();

        if (insertError) {
          errors++;
          errorMessages.push(`Client ${clientId}: ${insertError.message}`);
          continue;
        }

        created++;
        try {
          await createNotification({
            recipientType: "admin",
            recipientId: null,
            type: "withdrawal_request_received",
            title: "Auto withdrawal request created for approval",
            link: "/manage/funds-requests",
            payload: {
              amountUsd,
              amountInr,
              clientId,
              requestId: inserted?.id,
              isAuto: true,
            },
          });
        } catch (e) {
          console.error("[auto-withdrawal] notification:", e);
        }
      } catch (e) {
        errors++;
        errorMessages.push(
          `Client ${clientId}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    const status =
      errors > 0 ? (created > 0 ? "partial" : "failed") : "success";
    const finishedAt = new Date().toISOString();

    await recordCronJobRun({
      job_type: "auto_withdrawal",
      started_at: startedAt,
      finished_at: finishedAt,
      status,
      summary: {
        processed,
        created,
        skipped,
        errors,
      },
      error_message:
        errorMessages.length > 0 ? errorMessages.slice(0, 5).join("; ") : null,
    });

    return NextResponse.json({
      ok: true,
      processed,
      created,
      skipped,
      errors,
      errorMessages: errorMessages.slice(0, 10),
    });
  } catch (e) {
    const finishedAt = new Date().toISOString();
    const errMsg = e instanceof Error ? e.message : String(e);
    await recordCronJobRun({
      job_type: "auto_withdrawal",
      started_at: startedAt,
      finished_at: finishedAt,
      status: "failed",
      summary: { processed, created, skipped, errors },
      error_message: errMsg,
    });
    console.error("Auto withdrawal job failed", e);
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
