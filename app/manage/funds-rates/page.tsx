import { getFundsRates } from "@/lib/funds-rates";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";
import FundsRatesClient from "./funds-rates-client";

export default async function ManageFundsRatesPage() {
  const rates = await getFundsRates();

  return (
    <div>
      <AdminPageHeader
        title="Funds rates"
        description="Set USD to INR rates for deposit and withdrawal. Used for all funds calculations and display."
      />
      <AdminCard>
        <FundsRatesClient
          initialDepositInrPerUsd={rates.depositInrPerUsd}
          initialWithdrawalInrPerUsd={rates.withdrawalInrPerUsd}
        />
      </AdminCard>
    </div>
  );
}
