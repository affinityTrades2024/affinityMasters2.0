import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/server";
import { getFundsRates } from "@/lib/funds-rates";
import WithdrawalFormClient from "./withdrawal-form-client";

export default async function FundsWithdrawalPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const profile = await getProfileByEmail(session.email);
  if (!profile) redirect("/auth/login");

  const clientId = profile.id;
  const [rates, { data: accountsData }] = await Promise.all([
    getFundsRates(),
    supabase
      .from("accounts")
      .select("account_id, account_number, balance, free_funds, platform, product")
      .eq("client_id", clientId)
      .not("platform", "ilike", "%demo%"),
  ]);

  const accounts = (accountsData || []).map((a) => {
    const available =
      Number(a.free_funds ?? a.balance ?? 0) ?? 0;
    return {
      accountId: Number(a.account_id),
      label: (a.product as string) || (a.account_number as string) || String(a.account_id),
      accountNumber: String(a.account_number ?? ""),
      platform: (a.platform as string) || "—",
      availableUsd: available,
    };
  }).filter((a) => a.availableUsd > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Withdraw</h1>
        <p className="mt-1 text-gray-500">
          Request a withdrawal. Amount will be debited after admin approval.
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <WithdrawalFormClient
          accounts={accounts}
          withdrawalInrPerUsd={rates.withdrawalInrPerUsd}
        />
      </div>
    </div>
  );
}
