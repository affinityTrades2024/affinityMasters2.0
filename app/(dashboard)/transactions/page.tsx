import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { redirect } from "next/navigation";
import {
  buildAccountMaps,
  getTransactionsForClient,
  toDisplayTransactions,
} from "@/lib/transactions";
import Link from "next/link";
import TransactionsTableClient from "./transactions-table-client";

export default async function TransactionsPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const profile = await getProfileByEmail(session.email);
  if (!profile) redirect("/auth/login");

  const { transactions: rawTxs } = await getTransactionsForClient(profile.id);
  const { byId, byNumber, selfAccountNumbers } =
    await buildAccountMaps(profile.id);
  const transactions = toDisplayTransactions(
    rawTxs,
    byId,
    byNumber,
    selfAccountNumbers
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transaction History</h1>
        <Link
          href="/transactions/export"
          className="inline-flex items-center justify-center rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-700"
        >
          Export CSV
        </Link>
      </div>
      <TransactionsTableClient transactions={transactions} />
    </div>
  );
}
