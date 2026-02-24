import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/server";
import { getFundsRates } from "@/lib/funds-rates";
import { getInvestmentAccount } from "@/lib/investment-account";
import InfoBox from "@/components/InfoBox";
import { BiDollar, BiDownArrowCircle, BiUpArrowCircle } from "react-icons/bi";

export default async function FundsPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const profile = await getProfileByEmail(session.email);
  if (!profile) redirect("/auth/login");

  const clientId = profile.id;

  const [
    investmentAccount,
    { data: requests },
    rates,
  ] = await Promise.all([
    getInvestmentAccount(clientId),
    supabase
      .from("funds_requests")
      .select("id, type, amount_usd, amount_inr, status, requested_at")
      .eq("client_id", clientId)
      .order("requested_at", { ascending: false }),
    getFundsRates(),
  ]);

  const totalBalanceUsd = investmentAccount ? investmentAccount.balance : 0;
  const formatUsd = (n: number) =>
    "$" +
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatInr = (n: number) =>
    "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const displayRate = rates.depositInrPerUsd;

  const pending = (requests || []).filter((r) => r.status === "pending");
  const allRequests = requests || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Funds</h1>
        <p className="mt-1 text-gray-500">
          Deposit, withdraw, and track your fund requests.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <InfoBox
          icon={<BiDollar className="h-7 w-7" />}
          title="Estimated Total Balance"
          linkHref="/wallets"
          linkLabel="↗"
          value={formatUsd(totalBalanceUsd)}
          subValue={formatInr(totalBalanceUsd * displayRate)}
          variant="primary"
        />
        <Link href="/funds/deposit" className="block">
          <InfoBox
            icon={<BiDownArrowCircle className="h-7 w-7" />}
            title="Deposit"
            value="Request deposit"
            subValue={`Rate: ₹ ${rates.depositInrPerUsd} per 1 USD`}
            variant="success"
          />
        </Link>
        <Link href="/funds/withdrawal" className="block">
          <InfoBox
            icon={<BiUpArrowCircle className="h-7 w-7" />}
            title="Withdraw"
            value="Request withdrawal"
            subValue={`Rate: ₹ ${rates.withdrawalInrPerUsd} per 1 USD`}
            variant="warning"
          />
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Funds requests
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Pending requests are with admin. Balance updates only after approval.
          </p>
        </div>
        <div className="overflow-x-auto">
          {allRequests.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              No fund requests yet.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Amount (USD)
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Amount (INR)
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {allRequests.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {r.requested_at
                        ? new Date(r.requested_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">
                      {r.type}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatUsd(Number(r.amount_usd ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatInr(Number(r.amount_inr ?? 0))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          r.status === "pending"
                            ? "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                            : r.status === "approved"
                              ? "inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                              : "inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
                        }
                      >
                        {r.status === "pending"
                          ? "Pending with Admin"
                          : r.status === "approved"
                            ? "Approved"
                            : "Rejected"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
