import { supabase } from "@/lib/supabase/server";

export type NotificationRecipientType = "user" | "admin";

export interface CreateNotificationParams {
  recipientType: NotificationRecipientType;
  recipientId: number | null;
  type: string;
  title: string;
  link: string;
  body?: string | null;
  payload?: Record<string, unknown> | null;
}

/**
 * Insert a single in-app notification. Use after relevant events (funds approved/rejected, interest credited, etc.).
 * For admin notifications use recipientType 'admin' and recipientId null (all admins).
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const { recipientType, recipientId, type, title, link, body = null, payload = null } = params;
  const { error } = await supabase.from("notifications").insert({
    recipient_type: recipientType,
    recipient_id: recipientId,
    type,
    title,
    body,
    link,
    payload: payload ?? null,
  });
  if (error) {
    console.error("[notifications] createNotification failed:", error.message);
    throw new Error(`Failed to create notification: ${error.message}`);
  }
}
