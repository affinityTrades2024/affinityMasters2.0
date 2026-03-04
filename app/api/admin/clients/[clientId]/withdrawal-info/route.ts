import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getBankAccounts, getDefaultBankAccount } from "@/lib/bank-accounts";
import { getInvestmentAccount } from "@/lib/investment-account";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientId = parseInt((await params).clientId, 10);
  if (!Number.isFinite(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
  }

  try {
    const [bankAccounts, defaultBank, investmentAccount] = await Promise.all([
      getBankAccounts(clientId),
      getDefaultBankAccount(clientId),
      getInvestmentAccount(clientId),
    ]);
    const hasDefaultBank = defaultBank != null;
    return NextResponse.json({
      hasDefaultBank,
      defaultBankAccountId: defaultBank?.id ?? null,
      bankAccounts: bankAccounts.map((b) => ({
        id: b.id,
        bank: b.bank,
        accountNumberMasked: b.accountNumberMasked,
        ifscCode: b.ifscCode,
        isDefault: b.isDefault,
      })),
      investmentAccount: investmentAccount
        ? {
            accountId: investmentAccount.account_id,
            accountNumber: investmentAccount.account_number,
            balance: investmentAccount.balance,
          }
        : null,
    });
  } catch (e) {
    console.error("[withdrawal-info]", e);
    return NextResponse.json(
      { error: "Failed to load withdrawal info" },
      { status: 500 }
    );
  }
}
