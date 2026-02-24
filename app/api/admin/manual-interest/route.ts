import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { alreadyCreditedForDate, creditDailyInterest, getBalanceForInterest, getInterestRateForAccount, computeDailyInterestAmount } from "@/lib/interest";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { isAdmin } = await import("@/lib/admin");
  if (!(await isAdmin(session.email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const forDate = body?.forDate;
  let accountIds: number[] = body?.accountIds;
  const runAll = body?.all === true;

  if (!forDate) {
    return NextResponse.json({ error: "forDate required" }, { status: 400 });
  }
  if (!runAll && (!Array.isArray(accountIds) || accountIds.length === 0)) {
    return NextResponse.json(
      { error: "accountIds required (or set all: true to run for all investment accounts)" },
      { status: 400 }
    );
  }
  if (runAll) {
    const { data: rows } = await supabase
      .from("accounts")
      .select("account_id")
      .or("type.eq.investment,type.is.null,product.eq.PAMM Investor")
      .not("platform", "ilike", "%demo%");
    accountIds = (rows || []).map((r) => Number(r.account_id)).filter(Number.isFinite);
  }

  const [y, m] = forDate.split("-").map(Number);
  let credited = 0;
  let skipped = 0;
  for (const accountId of accountIds) {
    const existing = await alreadyCreditedForDate(accountId, forDate);
    if (existing.credited) {
      skipped++;
      continue;
    }
    const balance = await getBalanceForInterest(accountId, forDate);
    if (balance <= 0) continue;
    const rate = await getInterestRateForAccount(accountId);
    const amount = computeDailyInterestAmount(balance, rate, y, m);
    if (amount <= 0) continue;
    await creditDailyInterest(accountId, forDate, amount);
    credited++;
  }
  return NextResponse.json({ credited, skipped });
}
