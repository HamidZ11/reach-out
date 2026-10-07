import type { EmailOtpType } from "@supabase/supabase-js";
import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { authMode } from "@/server/config";
import { endDemo } from "@/server/demo";
import { NEXT_COOKIE, NEXT_COOKIE_OPTIONS } from "@/server/next-cookie";
import { safeNextPath } from "@/server/next-path";
import { getSupabase } from "@/server/supabase";

/** Link types Reachout sends: sign-in (and sign-up, which is the same email link). */
const LINK_TYPES: readonly EmailOtpType[] = ["email", "magiclink", "signup"];

/**
 * Where a sign-in link lands. A token hash (the link template in
 * supabase/templates, which works on any device) or a code (Supabase's default
 * link, same browser only) is exchanged for a session cookie. Then on to
 * where the user was going, checked to be a path inside Reachout; or back to
 * sign in, saying the link didn't work. Signing in for real ends the demo
 * (D-035), so the account's own records show.
 */
export async function GET(request: NextRequest) {
  if (authMode().kind !== "supabase") redirect("/");
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");

  const store = await cookies();
  const next = safeNextPath(store.get(NEXT_COOKIE)?.value);
  store.set(NEXT_COOKIE, "", { ...NEXT_COOKIE_OPTIONS, maxAge: 0 });

  const supabase = await getSupabase();
  let signedIn = false;
  if (tokenHash && type && LINK_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    signedIn = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    signedIn = !error;
  }
  if (signedIn) await endDemo();
  redirect(signedIn ? (next as Route) : "/sign-in?error=link");
}
