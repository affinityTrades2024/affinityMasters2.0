import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import AdminSidebar from "@/components/admin/AdminSidebar";

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
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
