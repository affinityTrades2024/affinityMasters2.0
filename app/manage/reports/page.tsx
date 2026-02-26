import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";
import ReportsClient from "./reports-client";

export default function ReportsPage() {
  return (
    <div>
      <AdminPageHeader
        title="Reports"
        description="Export and view deposit, payout, bank details, daily profit, partnership earnings, and pending disbursement reports."
      />
      <AdminCard className="mt-6">
        <ReportsClient />
      </AdminCard>
    </div>
  );
}
