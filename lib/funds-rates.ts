import { supabase } from "@/lib/supabase/server";

export interface FundsRates {
  depositInrPerUsd: number;
  withdrawalInrPerUsd: number;
}

const DEFAULT_RATES: FundsRates = {
  depositInrPerUsd: 84,
  withdrawalInrPerUsd: 82,
};

/**
 * Get current funds rates from DB (server-only). Use for deposit/withdrawal flows.
 * Returns defaults if table is missing or empty.
 */
export async function getFundsRates(): Promise<FundsRates> {
  const { data, error } = await supabase
    .from("funds_rates")
    .select("deposit_inr_per_usd, withdrawal_inr_per_usd")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_RATES;
  }
  return {
    depositInrPerUsd: Number(data.deposit_inr_per_usd) || DEFAULT_RATES.depositInrPerUsd,
    withdrawalInrPerUsd:
      Number(data.withdrawal_inr_per_usd) || DEFAULT_RATES.withdrawalInrPerUsd,
  };
}
