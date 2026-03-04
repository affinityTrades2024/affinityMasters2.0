import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { supabase } from "@/lib/supabase/server";
import { getFundsRates } from "@/lib/funds-rates";
import { getInvestmentAccountId } from "@/lib/investment-account";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const clientId = body?.clientId != null ? parseInt(String(body.clientId), 10) : NaN;
  const amountUsd = body?.amountUsd != null ? parseFloat(String(body.amountUsd)) : NaN;

  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Valid client is required" }, { status: 400 });
  }
  if (Number.isNaN(amountUsd) || amountUsd <= 0) {
    return NextResponse.json(
      { error: "Amount (USD) must be a positive number" },
      { status: 400 }
    );
  }
  if (amountUsd < 10) {
    return NextResponse.json(
      { error: "Minimum deposit is 10 USD" },
      { status: 400 }
    );
  }

  const accountId = await getInvestmentAccountId(clientId);
  if (accountId === null) {
    return NextResponse.json(
      { error: "No investment account linked for this client" },
      { status: 400 }
    );
  }

  const rates = await getFundsRates();
  const rateUsed = rates.depositInrPerUsd;
  const amountInr = Math.round(amountUsd * rateUsed * 100) / 100;

  const { data: inserted, error } = await supabase
    .from("funds_requests")
    .insert({
      client_id: clientId,
      type: "deposit",
      account_id: accountId,
      amount_usd: amountUsd,
      amount_inr: amountInr,
      rate_used: rateUsed,
      status: "pending",
      is_admin_initiated: true,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await createNotification({
      recipientType: "admin",
      recipientId: null,
      type: "deposit_request_received",
      title: "Deposit request received for approval",
      link: "/manage/funds-requests",
      payload: { amountUsd, amountInr, clientId, requestId: inserted?.id },
    });
  } catch (e) {
    console.error("[notifications] deposit_request_received:", e);
  }

  return NextResponse.json({ ok: true, id: inserted?.id });
}
