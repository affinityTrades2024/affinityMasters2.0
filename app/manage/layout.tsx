import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import AdminSidebar from "@/components/admin/AdminSidebar";
import NotificationBell from "@/components/NotificationBell";

export default async function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const admin = await isAdmin(session.email);
  if (!admin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminSidebar />
      <main className="pt-14 pl-0 lg:pt-0 lg:pl-64 min-h-screen">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-end border-b border-slate-200 bg-white px-4 shadow-sm">
          <NotificationBell />
        </header>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
