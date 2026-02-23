import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/server";
import TeamChartClient from "../team-chart-client";

export default async function ReferralPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const profile = await getProfileByEmail(session.email);
  if (!profile) redirect("/auth/login");

  const { data: pammOptions } = await supabase
    .from("pamm_master")
    .select("id, account_number, name")
    .eq("client_id", profile.id)
    .order("account_number");

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Referral</h1>
      <p className="text-gray-600 mb-4">
        Share your referral link and PAMM account with your network.
      </p>
      <TeamChartClient
        options={
          pammOptions?.map((p) => ({
            id: Number(p.id),
            accountNumber: String(p.account_number),
            name: (p.name as string) || String(p.account_number),
          })) ?? []
        }
      />
    </div>
  );
}
