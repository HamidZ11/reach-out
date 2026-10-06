import "server-only";
import { createHmac } from "node:crypto";
import { authMode, rateLimitSecret } from "./config";
import { getSupabase } from "./supabase";

/**
 * Durable rate limits in Postgres (D-032), counted per email address, client
 * address or user. The key is an HMAC with a server secret, so the database
 * never holds the address and nobody can spend another person's allowance.
 * Limits are set in the database function, not here.
 */
export type RateBucket = "sign_in_email" | "sign_in_address" | "gmail_connect" | "gmail_check";

export async function allowed(
  bucket: RateBucket,
  key: string,
  { whenUnavailable }: { whenUnavailable: "allow" | "refuse" },
): Promise<boolean> {
  // The development seed session has no database to count in.
  if (authMode().kind !== "supabase") return true;
  const hash = createHmac("sha256", rateLimitSecret()).update(`${bucket}:${key}`).digest("hex");
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("take_rate_limit", {
    p_bucket: bucket,
    p_key_hash: hash,
  });
  if (error) {
    console.error("A rate limit couldn't be checked", bucket);
    return whenUnavailable === "allow";
  }
  return data === true;
}

/** The client's address as the hosting proxy reports it (the first X-Forwarded-For hop). */
export function clientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
