import { cookies } from "next/headers";
import { MANAGER_EMAILS } from "@/lib/config";

const SESSION_COOKIE = "affinity_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  email: string;
  clientId: number | null;
  expiresAt: number;
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required");
  return secret;
}

/** Encode payload into a signed cookie value (simple HMAC-style sign). */
export async function encodeSession(payload: SessionPayload): Promise<string> {
  const secret = getSessionSecret();
  const data = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret.slice(0, 32).padEnd(32, "0")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(data)
  );
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${Buffer.from(data).toString("base64url")}.${sigHex}`;
}

/** Decode and verify session cookie. */
export async function decodeSession(
  value: string
): Promise<SessionPayload | null> {
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [dataB64, sigHex] = parts;
  const secret = getSessionSecret();
  const encoder = new TextEncoder();
  const data = Buffer.from(dataB64, "base64url").toString("utf8");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret.slice(0, 32).padEnd(32, "0")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(data)
  );
  const expectedSig = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (sigHex !== expectedSig) return null;
  try {
    const payload = JSON.parse(data) as SessionPayload;
    if (payload.expiresAt && payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  return decodeSession(value);
}

export async function setSession(payload: Omit<SessionPayload, "expiresAt">) {
  const cookieStore = await cookies();
  const full: SessionPayload = {
    ...payload,
    expiresAt: Date.now() + MAX_AGE * 1000,
  };
  const value = await encodeSession(full);
  cookieStore.set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * @deprecated Use isAdmin() from @/lib/admin (checks admin_users table).
 */
export function isManager(email: string): boolean {
  return MANAGER_EMAILS.includes(normalizeEmail(email));
}
