import { supabase } from "@/lib/supabase/server";

export interface Profile {
  id: number;
  email: string;
  nickname: string | null;
  info: {
    givenName: string;
    familyName: string;
    birthday: string | null;
  };
  phone: string | null;
  country_code: string | null;
  initials: string;
}

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase.rpc("get_client_by_email", {
    p_email: normalized,
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return null;
  }
  const row = data[0] as {
    id: number;
    email: string | null;
    nickname: string | null;
    name: string | null;
    birthday: string | null;
    phone: string | null;
    country: string | null;
  };
  const nameParts = (row.name || "").trim().split(/\s+/);
  const givenName = nameParts[0] || "";
  const familyName = nameParts.slice(1).join(" ") || "";
  const initials =
    givenName.charAt(0) + (familyName ? familyName.charAt(0) : givenName.charAt(1) || "")
      .toUpperCase();
  return {
    id: row.id,
    email: row.email || email,
    nickname: row.nickname,
    info: {
      givenName,
      familyName,
      birthday: row.birthday,
    },
    phone: row.phone,
    country_code: row.country,
    initials: initials.slice(0, 2).toUpperCase(),
  };
}
