import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";
import AutoWithdrawalClientsClient from "./auto-withdrawal-clients-client";

export default function AutoWithdrawalClientsPage() {
  return (
    <div>
      <AdminPageHeader
        title="Auto Withdrawal Clients"
        description="Users who have enabled auto withdrawal. Their monthly balance will be submitted as a withdrawal request on the 1st of each month at 01:00 UTC."
      />
      <AdminCard>
        <AutoWithdrawalClientsClient />
      </AdminCard>
    </div>
  );
}
