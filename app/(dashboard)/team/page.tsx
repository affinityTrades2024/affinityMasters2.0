import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { redirect } from "next/navigation";
import { getInvestmentAccount } from "@/lib/investment-account";
import TeamChartClient from "./team-chart-client";

export default async function TeamPage() {
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Team</h1>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-md">
      <TeamChartClient
        options={options}
      />
      </div>
    </div>
  );
}
