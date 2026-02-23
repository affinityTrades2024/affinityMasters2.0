import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/server";
import TeamChartClient from "./team-chart-client";

export default async function TeamPage() {
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Team</h1>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-md">
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
    </div>
  );
}
