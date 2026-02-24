import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { redirect } from "next/navigation";
import { getInvestmentAccount } from "@/lib/investment-account";

export default async function PammAccountsPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const profile = await getProfileByEmail(session.email);
  if (!profile) redirect("/auth/login");

  const account = await getInvestmentAccount(profile.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Investment Account</h1>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Account ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Account Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Account Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Profit
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Max DD
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Currency
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Balance
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Equity
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {!account ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  No investment account linked.
                </td>
              </tr>
            ) : (
              <tr className="hover:bg-gray-50 transition-colors">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {account.account_id}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                  {account.account_number}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  Investment Account
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  Subscribed
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  —
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  —
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  USD
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-medium text-gray-900">
                  {account.balance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-medium text-gray-900">
                  {account.balance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
