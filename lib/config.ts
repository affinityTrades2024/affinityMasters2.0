/**
 * App config: levels, managers, conversion rate, internal accounts.
 * Override via env where needed.
 */

export const USD_INR_RATE = Number(process.env.USD_INR_RATE) || 84;

export const LEVEL_0 = 5952.38;
export const LEVEL_1 = 29761.9;
export const LEVEL_2 = 59523.81;
export const LEVEL_3 = 119047.62;

export const LEVEL_NAMES: Record<number, string> = {
  0: "Star",
  1: "Double Star",
  2: "Diamond",
  3: "Platinum",
};

const MANAGER_EMAILS_STR =
  process.env.MANAGER_EMAILS ||
  "skarkhanis95@gmail.com,sagar@affinitytrades.com,contact@affinitytrades.com";
export const MANAGER_EMAILS = MANAGER_EMAILS_STR.split(",").map((e) =>
  e.trim().toLowerCase()
);

export const INTERNAL_ACCOUNTS: Record<number, string> = {
  129: "Master Account",
};

export const DEFAULT_INTEREST_RATE_MONTHLY = 3;
