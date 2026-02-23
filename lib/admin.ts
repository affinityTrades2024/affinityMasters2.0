import { supabase } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/auth";
import { MANAGER_EMAILS } from "@/lib/config";

/**
 * Check if the given email belongs to an admin (from admin_users table).
 * Falls back to MANAGER_EMAILS from config if the table is empty or not yet migrated.
 */
export async function isAdmin(email: string): Promise<boolean> {
  const clean = normalizeEmail(email);
  const { data, error } = await supabase
    .from("admin_users")
    .select("id")
    .ilike("email", clean)
    .maybeSingle();

  if (!error && data) return true;
  if (error) {
    if ((error as { code?: string }).code === "42P01") {
      return MANAGER_EMAILS.includes(clean);
    }
    return MANAGER_EMAILS.includes(clean);
  }
  return MANAGER_EMAILS.includes(clean);
}
