import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { supabase } from "@/lib/supabase/server";
import { getFundsRates } from "@/lib/funds-rates";
import { getInvestmentAccountId } from "@/lib/investment-account";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfileByEmail(session.email);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const amountUsd = body?.amountUsd != null ? parseFloat(String(body.amountUsd)) : NaN;
  const accountId = body?.accountId != null ? parseInt(String(body.accountId), 10) : NaN;

  if (Number.isNaN(amountUsd) || amountUsd <= 0) {
    return NextResponse.json(
      { error: "Amount (USD) must be a positive number" },
      { status: 400 }
    );
  }
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json(
      { error: "Valid account is required" },
      { status: 400 }
    );
  }

  const clientId = profile.id;
  const investmentAccountId = await getInvestmentAccountId(clientId);

  if (investmentAccountId === null) {
    return NextResponse.json(
      { error: "No investment account linked" },
      { status: 403 }
    );
  }
  if (accountId !== investmentAccountId) {
    return NextResponse.json(
      { error: "Account does not belong to you" },
      { status: 403 }
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
