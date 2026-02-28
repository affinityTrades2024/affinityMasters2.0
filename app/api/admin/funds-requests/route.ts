import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { createNotification } from "@/lib/notifications";

const MASTER_ACCOUNT_ID = 129;

async function getNextTransactionId(): Promise<number> {
  const { data } = await supabase
    .from("transactions")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id != null ? Number(data.id) + 1 : 1;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: requests, error } = await supabase
    .from("funds_requests")
    .select(
      "id, client_id, type, account_id, amount_usd, amount_inr, status, requested_at, is_auto_withdrawal"
    )
    .eq("status", "pending")
    .order("requested_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clientIds = [...new Set((requests || []).map((r) => r.client_id))];
  const { data: clients } = await supabase
    .from("clients")
    .select("id, email, name")
    .in("id", clientIds);
  const clientMap = new Map(
    (clients || []).map((c) => [c.id, { email: c.email as string, name: c.name as string }])
  );

  const accountIds = [...new Set((requests || []).map((r) => r.account_id))];
  const { data: accounts } = await supabase
    .from("accounts")
    .select("account_id, account_number")
    .in("account_id", accountIds);
  const { data: pamm } = await supabase
    .from("pamm_master")
    .select("id, account_number")
    .in("id", accountIds);
  const accountLabel = (id: number): string => {
    const a = (accounts || []).find((x) => x.account_id === id);
    if (a) return String(a.account_number ?? a.account_id);
    const p = (pamm || []).find((x) => x.id === id);
    if (p) return String(p.account_number ?? p.id);
    return String(id);
  };

  const list = (requests || []).map((r) => ({
    id: r.id,
    clientId: r.client_id,
    clientEmail: clientMap.get(r.client_id)?.email ?? "—",
    clientName: clientMap.get(r.client_id)?.name ?? "—",
    type: r.type,
    accountId: r.account_id,
    accountLabel: accountLabel(r.account_id),
    amountUsd: Number(r.amount_usd),
    amountInr: Number(r.amount_inr),
    requestedAt: r.requested_at,
    isAutoWithdrawal: Boolean(r.is_auto_withdrawal),
  }));

  return NextResponse.json({ requests: list });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(session.email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  const adminNotes = typeof body?.admin_notes === "string" ? body.admin_notes.trim() || null : null;

  if (action !== "approve" && action !== "reject" && action !== "disburse" && action !== "partial_disburse") {
    return NextResponse.json(
      { error: "action must be 'approve', 'reject', 'disburse', or 'partial_disburse'" },
      { status: 400 }
    );
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .ilike("email", session.email.trim().toLowerCase())
    .maybeSingle();
  const reviewedByAdminId = adminRow?.id ?? null;

  const rawIds = Array.isArray(body.ids) ? body.ids : [];
  const bulkIds = rawIds
    .map((x: unknown) => (typeof x === "number" && Number.isInteger(x) ? x : parseInt(String(x), 10)))
    .filter((n: number) => Number.isInteger(n) && n > 0)
    .slice(0, 50) as number[];

  if (bulkIds.length > 0 && (action === "approve" || action === "reject")) {
    let approved = 0;
    let rejected = 0;
    const errors: { id: number; message: string }[] = [];
    const bulkNotes = adminNotes;

    for (const bid of bulkIds) {
      try {
        const { data: row, error: fetchError } = await supabase
          .from("funds_requests")
          .select("id, client_id, type, account_id, amount_usd, status")
          .eq("id", bid)
          .single();

        if (fetchError || !row || row.status !== "pending") {
          errors.push({ id: bid, message: "Not found or not pending" });
          continue;
        }

        const amount = Number(row.amount_usd ?? 0);
        const accountId = Number(row.account_id);
        const clientId = row.client_id;

        if (action === "reject") {
          const { error: updError } = await supabase
            .from("funds_requests")
            .update({
              status: "rejected",
              reviewed_at: new Date().toISOString(),
              reviewed_by_admin_id: reviewedByAdminId,
            })
            .eq("id", bid);
          if (updError) {
            errors.push({ id: bid, message: updError.message });
            continue;
          }
          try {
            const notifType = row.type === "deposit" ? "deposit_rejected" : "withdrawal_rejected";
            const title =
              row.type === "deposit" ? "Deposit request rejected" : "Withdraw request rejected";
            await createNotification({
              recipientType: "user",
              recipientId: clientId,
              type: notifType,
              title,
              link: "/funds",
              payload: { amount },
            });
          } catch {
            // ignore notif failure
          }
          rejected++;
          continue;
        }

        if (action === "approve" && row.type === "withdrawal") {
          const { data: acc } = await supabase
            .from("accounts")
            .select("balance")
            .eq("account_id", accountId)
            .single();
          const available = Number(acc?.balance ?? 0);
          if (amount > available) {
            errors.push({ id: bid, message: "Insufficient balance to approve withdrawal" });
            continue;
          }
        }

        const nextTxId = await getNextTransactionId();
        const operationDate = new Date().toISOString().slice(0, 10);

        if (row.type === "deposit") {
          const { error: txError } = await supabase.from("transactions").insert({
            id: nextTxId,
            client_id: clientId,
            type: "deposit",
            source_account_id: MASTER_ACCOUNT_ID,
            destination_account_id: accountId,
            source_amount: amount,
            source_currency: "USD",
            destination_amount: amount,
            destination_currency: "USD",
            status: "completed",
            operation_date: operationDate,
          });
          if (txError) {
            errors.push({ id: bid, message: txError.message });
            continue;
          }
          const { data: acc } = await supabase
            .from("accounts")
            .select("balance")
            .eq("account_id", accountId)
            .single();
          const newBalance = (Number(acc?.balance ?? 0)) + amount;
          const { error: updAcc } = await supabase
            .from("accounts")
            .update({ balance: newBalance })
            .eq("account_id", accountId);
          if (updAcc) {
            errors.push({ id: bid, message: updAcc.message });
            continue;
          }
        }
        // Withdrawal: do not create transaction or debit account at approval; only at disbursement (full or partial).

        const newStatus = row.type === "withdrawal" ? "approved_pending_disbursement" : "approved";
        const updatePayload: Record<string, unknown> = {
          status: newStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by_admin_id: reviewedByAdminId,
          ...(row.type === "deposit" ? { transaction_id: nextTxId } : {}),
        };
        if (row.type === "deposit" && bulkNotes != null) {
          updatePayload.admin_notes = bulkNotes;
        }
        const { error: updReq } = await supabase
          .from("funds_requests")
          .update(updatePayload)
          .eq("id", bid);
        if (updReq) {
          errors.push({ id: bid, message: updReq.message });
          continue;
        }

        try {
          if (row.type === "deposit") {
            await createNotification({
              recipientType: "user",
              recipientId: clientId,
              type: "deposit_approved",
              title: "Deposit request approved",
              link: "/funds",
              payload: { transactionId: nextTxId, amount },
            });
          } else {
            await createNotification({
              recipientType: "user",
              recipientId: clientId,
              type: "withdrawal_approved",
              title: "Withdraw request approved",
              link: "/funds",
              payload: { amount },
            });
            await createNotification({
              recipientType: "admin",
              recipientId: null,
              type: "withdrawal_ready_for_disbursement",
              title: "Withdraw request ready for disbursement",
              link: "/manage/funds-requests/pending-withdrawals",
              payload: { requestId: bid, clientId, amount },
            });
          }
        } catch {
          // ignore notif failure
        }
        approved++;
      } catch (e) {
        errors.push({ id: bid, message: e instanceof Error ? e.message : String(e) });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: bulkIds.length,
      approved,
      rejected,
      errors: errors.length > 0 ? errors : undefined,
    });
  }

  const id = body?.id != null ? parseInt(String(body.id), 10) : NaN;
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Valid id required" }, { status: 400 });
  }

  const { data: row, error: fetchError } = await supabase
    .from("funds_requests")
    .select("id, client_id, type, account_id, amount_usd, status")
    .eq("id", id)
    .single();

  if (action === "disburse") {
    if (fetchError || !row) {
      return NextResponse.json({ error: "Request not found" }, { status: 400 });
    }
    if (row.type !== "withdrawal") {
      return NextResponse.json({ error: "Only withdrawal requests can be marked disbursed" }, { status: 400 });
    }
    if (row.status !== "approved_pending_disbursement") {
      return NextResponse.json(
        { error: "Request must be in Approved – Processing payout status to mark as disbursed" },
        { status: 400 }
      );
    }
    const amountUsd = Number(row.amount_usd ?? 0);
    const accountId = Number(row.account_id);
    const clientId = row.client_id;

    const { data: acc } = await supabase
      .from("accounts")
      .select("balance")
      .eq("account_id", accountId)
      .single();
    const available = Number(acc?.balance ?? 0);
    if (amountUsd > available) {
      return NextResponse.json(
        { error: "Insufficient balance to disburse withdrawal" },
        { status: 400 }
      );
    }

    const nextTxId = await getNextTransactionId();
    const operationDate = new Date().toISOString().slice(0, 10);
    const { error: txError } = await supabase.from("transactions").insert({
      id: nextTxId,
      client_id: clientId,
      type: "withdrawal",
      source_account_id: accountId,
      destination_account_id: MASTER_ACCOUNT_ID,
      source_amount: amountUsd,
      source_currency: "USD",
      destination_amount: amountUsd,
      destination_currency: "USD",
      status: "completed",
      operation_date: operationDate,
    });
    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }
    const newBalance = Math.max(0, available - amountUsd);
    const { error: updAcc } = await supabase
      .from("accounts")
      .update({ balance: newBalance })
      .eq("account_id", accountId);
    if (updAcc) {
      return NextResponse.json({ error: updAcc.message }, { status: 500 });
    }

    const { error: disbError } = await supabase
      .from("funds_requests")
      .update({
        status: "disbursed",
        disbursed_at: new Date().toISOString(),
        admin_notes: adminNotes,
        transaction_id: nextTxId,
      })
      .eq("id", id);
    if (disbError) {
      return NextResponse.json({ error: disbError.message }, { status: 500 });
    }
    try {
      await createNotification({
        recipientType: "user",
        recipientId: clientId,
        type: "withdrawal_disbursed",
        title: "Withdraw request disbursed",
        link: "/funds",
        payload: { transactionId: nextTxId, amount: amountUsd },
      });
    } catch (e) {
      console.error("[notifications] withdrawal_disbursed:", e);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "partial_disburse") {
    if (fetchError || !row) {
      return NextResponse.json({ error: "Request not found" }, { status: 400 });
    }
    if (row.type !== "withdrawal") {
      return NextResponse.json(
        { error: "Only withdrawal requests can be partially disbursed" },
        { status: 400 }
      );
    }
    if (row.status !== "approved_pending_disbursement") {
      return NextResponse.json(
        {
          error:
            "Request must be in Approved – Processing payout status for partial disbursement",
        },
        { status: 400 }
      );
    }
    const requestedUsd = Number(row.amount_usd ?? 0);
    if (requestedUsd <= 0) {
      return NextResponse.json({ error: "Invalid request amount" }, { status: 400 });
    }
    const partialComment =
      typeof body?.partial_withdrawal_comment === "string"
        ? body.partial_withdrawal_comment.trim()
        : "";
    if (!partialComment) {
      return NextResponse.json(
        { error: "Comments are mandatory for partial withdrawal" },
        { status: 400 }
      );
    }
    let disbursedUsd: number;
    if (body?.disbursed_amount_usd != null) {
      disbursedUsd = parseFloat(String(body.disbursed_amount_usd));
      if (!Number.isFinite(disbursedUsd) || disbursedUsd <= 0 || disbursedUsd > requestedUsd) {
        return NextResponse.json(
          {
            error: `Disbursed amount must be a positive number not greater than requested (${requestedUsd})`,
          },
          { status: 400 }
        );
      }
    } else if (body?.disbursed_percent != null) {
      const pct = parseFloat(String(body.disbursed_percent));
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        return NextResponse.json(
          { error: "Disbursed percent must be between 0 and 100" },
          { status: 400 }
        );
      }
      disbursedUsd = Math.round((requestedUsd * pct) / 100 * 1e6) / 1e6;
      if (disbursedUsd <= 0 || disbursedUsd > requestedUsd) {
        return NextResponse.json(
          { error: "Computed disbursed amount is invalid" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Provide either disbursed_amount_usd or disbursed_percent" },
        { status: 400 }
      );
    }
    const differenceUsd = Math.round((requestedUsd - disbursedUsd) * 1e6) / 1e6;
    if (differenceUsd <= 0) {
      return NextResponse.json(
        { error: "Use full disbursement for 100% payout" },
        { status: 400 }
      );
    }

    const accountId = Number(row.account_id);
    const clientId = row.client_id;
    const { data: acc } = await supabase
      .from("accounts")
      .select("balance")
      .eq("account_id", accountId)
      .single();
    const available = Number(acc?.balance ?? 0);
    if (disbursedUsd > available) {
      return NextResponse.json(
        { error: "Insufficient balance to disburse this amount" },
        { status: 400 }
      );
    }

    const nextTxId = await getNextTransactionId();
    const operationDate = new Date().toISOString().slice(0, 10);
    const { error: txError } = await supabase.from("transactions").insert({
      id: nextTxId,
      client_id: clientId,
      type: "withdrawal",
      source_account_id: accountId,
      destination_account_id: MASTER_ACCOUNT_ID,
      source_amount: disbursedUsd,
      source_currency: "USD",
      destination_amount: disbursedUsd,
      destination_currency: "USD",
      status: "completed",
      operation_date: operationDate,
    });
    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }
    const newBalance = Math.max(0, available - disbursedUsd);
    const { error: updAccErr } = await supabase
      .from("accounts")
      .update({ balance: newBalance })
      .eq("account_id", accountId);
    if (updAccErr) {
      return NextResponse.json({ error: updAccErr.message }, { status: 500 });
    }

    const { error: updErr } = await supabase
      .from("funds_requests")
      .update({
        status: "disbursed",
        disbursed_at: new Date().toISOString(),
        disbursed_amount_usd: disbursedUsd,
        partial_withdrawal_comment: partialComment,
        admin_notes: adminNotes,
        transaction_id: nextTxId,
      })
      .eq("id", id);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const { error: insErr } = await supabase.from("pending_disbursal_entries").insert({
      client_id: row.client_id,
      amount_usd: differenceUsd,
      source_funds_request_id: id,
      admin_comments: partialComment,
      status: "pending",
    });
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    try {
      await createNotification({
        recipientType: "user",
        recipientId: row.client_id,
        type: "partial_withdrawal_recorded",
        title: "Partial withdrawal recorded",
        link: "/funds",
        payload: {
          requestId: id,
          disbursedAmount: disbursedUsd,
          pendingAmount: differenceUsd,
          comment: partialComment,
        },
      });
    } catch (e) {
      console.error("[notifications] partial_withdrawal_recorded:", e);
    }
    return NextResponse.json({ ok: true });
  }

  if (fetchError || !row || row.status !== "pending") {
    return NextResponse.json(
      { error: "Request not found or not pending" },
      { status: 400 }
    );
  }

  const amount = Number(row.amount_usd ?? 0);
  const accountId = Number(row.account_id);
  const clientId = row.client_id;

  if (action === "reject") {
    const { error: updError } = await supabase
      .from("funds_requests")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by_admin_id: reviewedByAdminId,
      })
      .eq("id", id);
    if (updError) {
      return NextResponse.json({ error: updError.message }, { status: 500 });
    }
    try {
      const notifType = row.type === "deposit" ? "deposit_rejected" : "withdrawal_rejected";
      const title =
        row.type === "deposit"
          ? "Deposit request rejected"
          : "Withdraw request rejected";
      await createNotification({
        recipientType: "user",
        recipientId: clientId,
        type: notifType,
        title,
        link: "/funds",
        payload: { amount },
      });
    } catch (e) {
      console.error("[notifications] reject:", e);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    if (row.type === "withdrawal") {
      const { data: acc } = await supabase
        .from("accounts")
        .select("balance")
        .eq("account_id", accountId)
        .single();
      const available = Number(acc?.balance ?? 0);
      if (amount > available) {
        return NextResponse.json(
          { error: "Insufficient balance to approve withdrawal" },
          { status: 400 }
        );
      }
    }

    const nextTxId = await getNextTransactionId();
    const operationDate = new Date().toISOString().slice(0, 10);

    if (row.type === "deposit") {
      const { error: txError } = await supabase.from("transactions").insert({
        id: nextTxId,
        client_id: clientId,
        type: "deposit",
        source_account_id: MASTER_ACCOUNT_ID,
        destination_account_id: accountId,
        source_amount: amount,
        source_currency: "USD",
        destination_amount: amount,
        destination_currency: "USD",
        status: "completed",
        operation_date: operationDate,
      });
      if (txError) {
        return NextResponse.json({ error: txError.message }, { status: 500 });
      }
      const { data: acc } = await supabase
        .from("accounts")
        .select("balance")
        .eq("account_id", accountId)
        .single();
      const newBalance = (Number(acc?.balance ?? 0)) + amount;
      const { error: updAcc } = await supabase
        .from("accounts")
        .update({ balance: newBalance })
        .eq("account_id", accountId);
      if (updAcc) {
        return NextResponse.json({ error: updAcc.message }, { status: 500 });
      }
    }
    // Withdrawal: do not create transaction or debit at approval; only at disbursement (full or partial).

    const newStatus = row.type === "withdrawal" ? "approved_pending_disbursement" : "approved";
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by_admin_id: reviewedByAdminId,
      ...(row.type === "deposit" ? { transaction_id: nextTxId } : {}),
    };
    if (row.type === "deposit" && adminNotes != null) {
      updatePayload.admin_notes = adminNotes;
    }

    const { error: updReq } = await supabase
      .from("funds_requests")
      .update(updatePayload)
      .eq("id", id);
    if (updReq) {
      return NextResponse.json({ error: updReq.message }, { status: 500 });
    }

    try {
      if (row.type === "deposit") {
        await createNotification({
          recipientType: "user",
          recipientId: clientId,
          type: "deposit_approved",
          title: "Deposit request approved",
          link: "/funds",
          payload: { transactionId: nextTxId, amount },
        });
      } else {
        await createNotification({
          recipientType: "user",
          recipientId: clientId,
          type: "withdrawal_approved",
          title: "Withdraw request approved",
          link: "/funds",
          payload: { amount },
        });
        await createNotification({
          recipientType: "admin",
          recipientId: null,
          type: "withdrawal_ready_for_disbursement",
          title: "Withdraw request ready for disbursement",
          link: "/manage/funds-requests/pending-withdrawals",
          payload: { requestId: id, clientId, amount },
        });
      }
    } catch (e) {
      console.error("[notifications] approve:", e);
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
