import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authModeOrNull } from "@/server/config";
import { contentSecurityPolicy } from "@/server/csp";
import { AUTH_COOKIE_OPTIONS, timedFetch } from "@/server/supabase";

/**
 * Runs before every page and Server Action (not static files):
 *
 * 1. Sets a Content Security Policy with a fresh nonce (Next applies it to
 *    its own scripts; every page is rendered per request).
 * 2. Refreshes the Supabase session, writing renewed cookies on the response,
 *    so Server Components (which can't set cookies) see a valid session.
 * 3. Sends a signed-out page load to sign in, remembering where it was going,
 *    and a signed-in visit to /sign-in on to the app.
 *
 * This is the optimistic check only. Every read and write still verifies the
 * session in the data access layer (`getRepository` → `requireSession`), and
 * an unconfigured deployment fails closed there.
 */
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce, request.nextUrl.protocol === "https:");
  // Next reads the policy from the request to put the nonce on its own scripts.
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return NextResponse.next({ request: { headers } });
  };
  const secured = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  let response = forward();
  const mode = authModeOrNull();
  if (mode?.kind !== "supabase") return secured(response);

  const supabase = createServerClient(mode.url, mode.publishableKey, {
    global: { fetch: timedFetch },
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet, headers) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = forward();
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  const navigation = request.method === "GET" || request.method === "HEAD";
  if (navigation && !signedIn && !isPublic(pathname)) {
    return secured(withCookies(response, redirectTo(request, "/sign-in", `${pathname}${search}`)));
  }
  if (navigation && signedIn && pathname === "/sign-in") {
    return secured(withCookies(response, redirectTo(request, "/")));
  }
  return secured(response);
}

/** Sign-in and its link, and the development-only design reference, need no session. */
function isPublic(pathname: string) {
  return (
    pathname === "/sign-in" || pathname.startsWith("/auth/") || pathname.startsWith("/prototypes")
  );
}

function redirectTo(request: NextRequest, path: string, next?: string) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  if (next && next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

/** A redirect still carries the refreshed session. */
function withCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
  const cache = from.headers.get("cache-control");
  if (cache) to.headers.set("cache-control", cache);
  return to;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
