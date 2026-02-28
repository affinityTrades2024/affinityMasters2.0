import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";
import PartialDisbursalRequestsClient from "./partial-disbursal-requests-client";

export default function PartialDisbursalRequestsPage() {
  return (
    <div>
      <AdminPageHeader
        title="Partial Disbursal Requests"
        description="Settle pending amounts from partial withdrawals. Add comments and click Settle to credit the user's account and close the entry."
      />
      <AdminCard>
        <PartialDisbursalRequestsClient />
      </AdminCard>
    </div>
  );
}
