import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";
import PendingWithdrawalsClient from "./pending-withdrawals-client";

export default function PendingWithdrawalsPage() {
  return (
    <div>
      <AdminPageHeader
        title="Pending withdrawal requests"
        description="Withdrawals approved and awaiting disbursement. Mark as disbursed when the payout has been sent and optionally add a transaction reference."
      />
      <AdminCard>
        <PendingWithdrawalsClient />
      </AdminCard>
    </div>
  );
}
