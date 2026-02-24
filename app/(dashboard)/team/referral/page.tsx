import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { redirect } from "next/navigation";
import { getInvestmentAccount } from "@/lib/investment-account";
import TeamChartClient from "../team-chart-client";

export default async function ReferralPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const profile = await getProfileByEmail(session.email);
  if (!profile) redirect("/auth/login");

  const account = await getInvestmentAccount(profile.id);
  const options = account
    ? [
        {
          id: account.account_id,
          accountNumber: account.account_number,
          name: "Investment Account",
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Referral</h1>
      <p className="text-gray-600 mb-4">
        Share your referral link and investment account with your network.
      </p>
      <TeamChartClient
        options={options}
      />
    </div>
  );
}
