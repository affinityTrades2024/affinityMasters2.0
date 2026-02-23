import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/server";
import { getFundsRates } from "@/lib/funds-rates";
import DepositFormClient from "./deposit-form-client";

export default async function FundsDepositPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const profile = await getProfileByEmail(session.email);
  if (!profile) redirect("/auth/login");

  const clientId = profile.id;
  const [rates, { data: accountsData }, { data: pammData }] = await Promise.all([
    getFundsRates(),
    supabase
      .from("accounts")
      .select("account_id, account_number, platform, product")
      .eq("client_id", clientId)
      .not("platform", "ilike", "%demo%"),
    supabase
      .from("pamm_master")
      .select("id, account_number, name")
      .eq("client_id", clientId),
  ]);

  const accounts: { accountId: number; label: string; accountNumber: string; platform: string }[] = [];
  for (const a of accountsData || []) {
    accounts.push({
      accountId: Number(a.account_id),
      label: (a.product as string) || (a.account_number as string) || String(a.account_id),
      accountNumber: String(a.account_number ?? ""),
      platform: (a.platform as string) || "—",
    });
  }
  for (const p of pammData || []) {
    accounts.push({
      accountId: Number(p.id),
      label: (p.name as string) || String(p.account_number),
      accountNumber: String(p.account_number ?? ""),
      platform: "PAMM",
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Deposit</h1>
        <p className="mt-1 text-gray-500">
          Request a deposit. Amount will be credited after admin approval.
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <DepositFormClient
          accounts={accounts}
          depositInrPerUsd={rates.depositInrPerUsd}
        />
      </div>
    </div>
  );
}
