import {
  buildAccountMaps,
  getTransactionsByType,
  toDisplayTransactions,
} from "@/lib/transactions";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import Link from "next/link";
import TransactionsTableClient from "@/app/(dashboard)/transactions/transactions-table-client";

export default async function ProfitSharingTransactionsPage() {
  const rawTxs = await getTransactionsByType("daily_interest");
  const { byId, selfAccountNumbers } = await buildAccountMaps(0, rawTxs);
  const transactions = toDisplayTransactions(
    rawTxs,
    byId,
    selfAccountNumbers
  );

  return (
    <div>
      <AdminPageHeader
        title="Profit Sharing Transactions"
        description="All interest (profit sharing) transactions credited to accounts, from automatic and manual runs."
      />
      <div className="mt-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-slate-600">
            {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
          </span>
          <Link
            href="/manage/profit-sharing/transactions/export"
            className="inline-flex items-center justify-center rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-700"
          >
            Export CSV
          </Link>
        </div>
        <TransactionsTableClient transactions={transactions} />
      </div>
    </div>
  );
}
