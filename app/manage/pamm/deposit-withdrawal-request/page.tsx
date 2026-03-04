import { getFundsRates } from "@/lib/funds-rates";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";
import DepositWithdrawalRequestClient from "./deposit-withdrawal-request-client";

export default async function DepositWithdrawalRequestPage() {
  const rates = await getFundsRates();
  return (
    <div>
      <AdminPageHeader
        title="Deposit/Withdrawal Request"
        description="Raise a deposit or withdrawal request on behalf of a user. Search by name, email, or account number."
      />
      <AdminCard>
        <DepositWithdrawalRequestClient
          depositInrPerUsd={rates.depositInrPerUsd}
          withdrawalInrPerUsd={rates.withdrawalInrPerUsd}
        />
      </AdminCard>
    </div>
  );
}
