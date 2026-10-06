import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { ReachoutClient } from "@/data/supabase/supabase-repository";
import type { Database } from "@/data/supabase/database.types";
import type { AuthMode } from "./config";
import { authMode } from "./config";

/**
 * Session cookies are httpOnly: Reachout has no browser Supabase client, so
 * page scripts never need (or see) the tokens. Every Supabase call happens on
 * the server, as the signed-in user.
 */
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

/** How long any one call to Supabase may take before the request gives up. */
const SUPABASE_TIMEOUT_MS = 10_000;

/**
 * Supabase calls never hang a page or an action: each one is abandoned after
 * SUPABASE_TIMEOUT_MS and reported as unavailable. A write that timed out may
 * still have happened; the next one is checked against the saved version.
 */
export const timedFetch: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(SUPABASE_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
};

/** One Supabase client per request, carrying the user's session from cookies. */
export const getSupabase = cache(async (): Promise<ReachoutClient> => {
  const mode = authMode();
  if (mode.kind !== "supabase") throw new Error("Supabase is not the configured auth mode");
  return createSupabaseClient(mode);
});

async function createSupabaseClient(mode: Extract<AuthMode, { kind: "supabase" }>) {
  const store = await cookies();
  return createServerClient<Database>(mode.url, mode.publishableKey, {
    global: { fetch: timedFetch },
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Server Components can't set cookies. The proxy refreshes the
          // session before rendering, so nothing is lost here.
        }
      },
    },
  });
}
