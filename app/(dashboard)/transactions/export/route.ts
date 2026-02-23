import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import {
  buildAccountMaps,
  getTransactionsForClient,
  toDisplayTransactions,
} from "@/lib/transactions";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const profile = await getProfileByEmail(session.email);
  if (!profile) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { transactions: rawTxs } = await getTransactionsForClient(profile.id);
  const { byId, byNumber, selfAccountNumbers } =
    await buildAccountMaps(profile.id);
  const transactions = toDisplayTransactions(
    rawTxs,
    byId,
    byNumber,
    selfAccountNumbers
  );

  const headers = [
    "Transaction ID",
    "Date & Time",
    "Type",
    "Amount",
    "Currency",
    "From Account",
    "To Account",
    "Platform",
    "Status",
  ];
  const rows = transactions.map((t) => [
    t.transactionId,
    t.createTime ? new Date(t.createTime).toISOString() : "",
    t.type,
    t.creditDetails.amount,
    t.creditDetails.currency.alphabeticCode,
    `${t.debitDetails.account.clientName} (${t.debitDetails.account.accountNumber})`,
    `${t.creditDetails.account.clientName} (${t.creditDetails.account.accountNumber})`,
    t.creditDetails.account.platform,
    t.status,
  ]);

  const escape = (v: string | number) => {
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="transactions.csv"',
    },
  });
}
