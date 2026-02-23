import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { alreadyCreditedForDate, creditDailyInterest, getBalanceForInterest, getInterestRateForAccount, computeDailyInterestAmount } from "@/lib/interest";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { isAdmin } = await import("@/lib/admin");
  if (!(await isAdmin(session.email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const forDate = body?.forDate;
  const accountIds = body?.accountIds;
  if (!forDate || !Array.isArray(accountIds)) {
    return NextResponse.json(
      { error: "forDate and accountIds required" },
      { status: 400 }
    );
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
