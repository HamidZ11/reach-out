"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { SignInState } from "@/features/sign-in/state";
import { authMode } from "@/server/config";
import { NEXT_COOKIE, NEXT_COOKIE_OPTIONS } from "@/server/next-cookie";
import { safeNextPath } from "@/server/next-path";
import { allowed, clientAddress } from "@/server/rate-limit";
import { getSupabase } from "@/server/supabase";

/**
 * Sign-in by email link (D-026): no passwords, no third-party accounts. The
 * same request signs a new address up, so the answer never says whether an
 * account exists: known, new, or refused because sign-ups are closed, it is
 * the same "check your email". Where to return afterwards waits in a
 * short-lived httpOnly cookie, checked again when the link is opened.
 *
 * Requests are limited per address and per client (D-032) before Supabase is
 * asked, because Supabase's own limits see only Reachout's server.
 */
const SLOW_DOWN = "That's a lot of sign-in emails. Wait a few minutes, then try again.";
export async function requestSignInLink(
  _previous: SignInState,
  form: FormData,
): Promise<SignInState> {
  const typed = String(form.get("email") ?? "").trim();
  const email = z.email().max(320).safeParse(typed.toLowerCase());
  if (!email.success) {
    return {
      status: "problem",
      field: "email",
      email: typed,
      message: "That doesn't look like an email address.",
    };
  }
  if (authMode().kind !== "supabase") {
    return {
      status: "problem",
      email: typed,
      message: "This development session doesn't use sign-in.",
    };
  }

  const address = clientAddress(await headers());
  const [byAddress, byEmail] = await Promise.all([
    allowed("sign_in_address", address, { whenUnavailable: "allow" }),
    allowed("sign_in_email", email.data, { whenUnavailable: "allow" }),
  ]);
  if (!byAddress || !byEmail) return { status: "problem", email: typed, message: SLOW_DOWN };

  const store = await cookies();
  store.set(NEXT_COOKIE, safeNextPath(form.get("next")), NEXT_COOKIE_OPTIONS);

  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${await origin()}/auth/confirm`, shouldCreateUser: true },
  });
  if (error) {
    if (error.status === 429) return { status: "problem", email: typed, message: SLOW_DOWN };
    // Sign-ups closed: an unknown address gets the same answer as a known one.
    if (error.code === "signup_disabled" || error.code === "otp_disabled") {
      return { status: "sent", email: email.data };
    }
    console.error("Sending a sign-in link failed", error.code ?? error.name);
    return {
      status: "problem",
      email: typed,
      message: "We couldn't send the link. Try again in a moment.",
    };
  }
  return { status: "sent", email: email.data };
}

/** Ends this browser's session and returns to sign in. */
export async function signOut(): Promise<void> {
  if (authMode().kind === "supabase") {
    const supabase = await getSupabase();
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/sign-in");
}

/** This site's origin, as the browser sent it with the form. Supabase only accepts allow-listed ones. */
async function origin(): Promise<string> {
  const h = await headers();
  const sent = h.get("origin");
  if (sent) return sent;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
