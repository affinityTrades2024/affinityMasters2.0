import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import Sidebar from "@/components/Sidebar";
import AppHeader from "@/components/AppHeader";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const profile = await getProfileByEmail(session.email);
  if (!profile) redirect("/auth/login");

  const profileName =
    profile.nickname ||
    [profile.info.givenName, profile.info.familyName].filter(Boolean).join(" ") ||
    profile.email;

  const admin = await isAdmin(session.email);

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar isAdmin={admin} />
      <div className="pl-64">
        <AppHeader profileName={profileName} profileEmail={profile.email} />
        <main className="min-h-[calc(100vh-4rem)] p-4 md:p-6">
          {children}
        </main>
        <footer className="border-t border-gray-200 bg-white px-6 py-3 text-center text-sm text-gray-500">
          <strong>Copyright &copy; 2014-2025 Affinity Trades.</strong> All rights reserved.
        </footer>
      </div>
    </div>
  );
}
