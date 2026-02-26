import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import DashboardShell from "@/components/DashboardShell";

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
    <DashboardShell
      isAdmin={admin}
      profileName={profileName}
      profileEmail={profile.email}
    >
      {children}
    </DashboardShell>
  );
}
