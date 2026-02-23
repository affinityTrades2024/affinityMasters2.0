import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function WalletsPage() {
  await getSession();
  // Protected by layout
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Wallets</h1>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800 shadow-sm">
        <p className="font-medium">This section is being upgraded.</p>
        <p className="mt-1 text-sm">Please check back later.</p>
      </div>
    </div>
  );
}
