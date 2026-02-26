import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { redirect } from "next/navigation";
import { getFundsRates } from "@/lib/funds-rates";
import { getInvestmentAccount } from "@/lib/investment-account";
import { getBankAccounts, getDefaultBankAccount } from "@/lib/bank-accounts";
import WithdrawalFormClient from "./withdrawal-form-client";
import AutoWithdrawalBlock from "@/components/AutoWithdrawalBlock";

export default async function FundsWithdrawalPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const profile = await getProfileByEmail(session.email);
  if (!profile) redirect("/auth/login");

  const clientId = profile.id;
  const [rates, investmentAccount, bankAccounts, defaultBankAccount] = await Promise.all([
    getFundsRates(),
    getInvestmentAccount(clientId),
    getBankAccounts(clientId),
    getDefaultBankAccount(clientId),
  ]);

  const account = investmentAccount
    ? {
        accountId: investmentAccount.account_id,
        label: investmentAccount.product || investmentAccount.account_number || "Investment Account",
        accountNumber: investmentAccount.account_number,
        availableUsd: investmentAccount.balance,
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Withdraw</h1>
        <p className="mt-1 text-gray-500">
          Request a withdrawal from your investment account. Amount will be debited after admin approval.
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <WithdrawalFormClient
          account={account}
          withdrawalInrPerUsd={rates.withdrawalInrPerUsd}
          bankAccounts={bankAccounts}
          defaultBankAccount={defaultBankAccount}
        />
      </div>
      <AutoWithdrawalBlock />
    </div>
  );
}
