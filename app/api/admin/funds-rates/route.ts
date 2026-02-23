import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

export async function GET() {
  const { data, error } = await supabase
    .from("funds_rates")
    .select("deposit_inr_per_usd, withdrawal_inr_per_usd")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { depositInrPerUsd: 84, withdrawalInrPerUsd: 82 },
      { status: 200 }
    );
  }
  if (!data) {
    return NextResponse.json(
      { depositInrPerUsd: 84, withdrawalInrPerUsd: 82 },
      { status: 200 }
    );
  }
  return NextResponse.json({
    depositInrPerUsd: Number(data.deposit_inr_per_usd) || 84,
    withdrawalInrPerUsd: Number(data.withdrawal_inr_per_usd) || 82,
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const depositInrPerUsd = body?.depositInrPerUsd;
  const withdrawalInrPerUsd = body?.withdrawalInrPerUsd;

  const d = depositInrPerUsd != null ? parseFloat(String(depositInrPerUsd)) : NaN;
  const w =
    withdrawalInrPerUsd != null ? parseFloat(String(withdrawalInrPerUsd)) : NaN;
  if (Number.isNaN(d) || d <= 0 || Number.isNaN(w) || w <= 0) {
    return NextResponse.json(
      { error: "depositInrPerUsd and withdrawalInrPerUsd must be positive numbers" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("funds_rates")
    .upsert(
      {
        id: 1,
        deposit_inr_per_usd: d,
        withdrawal_inr_per_usd: w,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
