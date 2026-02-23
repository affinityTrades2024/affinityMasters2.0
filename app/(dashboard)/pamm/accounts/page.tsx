import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/server";

export default async function PammAccountsPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const profile = await getProfileByEmail(session.email);
  if (!profile) redirect("/auth/login");

  const { data: accounts } = await supabase
    .from("accounts")
    .select(
      "account_id, account_number, client_name, product, currency, balance, equity"
    )
    .eq("client_id", profile.id)
    .eq("product", "PAMM Investor")
    .order("account_id");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Account List</h1>
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
            {!accounts?.length ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  No PAMM Investor accounts found.
                </td>
              </tr>
            ) : (
              accounts.map((a) => (
                <tr key={a.account_id} className="hover:bg-gray-50 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {a.account_id}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                    {a.account_number}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {a.client_name || a.product || "—"}
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
                    {a.currency}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-medium text-gray-900">
                    {Number(a.balance ?? 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-right font-medium text-gray-900">
                    {Number(a.equity ?? 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
