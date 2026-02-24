import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ProfileTabs from "./profile-tabs";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const profile = await getProfileByEmail(session.email);
  if (!profile) redirect("/auth/login");

  return (
    <Suspense fallback={<div className="space-y-6"><h1 className="text-2xl font-bold text-gray-900">Settings</h1><div className="rounded-xl border border-gray-200 bg-white p-6 shadow-md"><p className="text-gray-500">Loading…</p></div></div>}>
      <ProfileTabs profile={profile} />
    </Suspense>
  );
}
