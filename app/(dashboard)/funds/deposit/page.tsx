import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { redirect } from "next/navigation";
import { getFundsRates } from "@/lib/funds-rates";
import { getInvestmentAccount } from "@/lib/investment-account";
import DepositFormClient from "./deposit-form-client";

export default async function FundsDepositPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const profile = await getProfileByEmail(session.email);
  if (!profile) redirect("/auth/login");

  const clientId = profile.id;
  const [rates, investmentAccount] = await Promise.all([
    getFundsRates(),
    getInvestmentAccount(clientId),
  ]);

  const account = investmentAccount
    ? {
        accountId: investmentAccount.account_id,
        label: investmentAccount.product || investmentAccount.account_number || "Investment Account",
        accountNumber: investmentAccount.account_number,
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Deposit</h1>
        <p className="mt-1 text-gray-500">
          Request a deposit. Amount will be credited to your investment account after admin approval.
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <DepositFormClient
          account={account}
          depositInrPerUsd={rates.depositInrPerUsd}
        />
      </div>
    </div>
  );
}
