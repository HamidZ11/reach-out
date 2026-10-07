/**
 * The demo workspace's cookie (D-035), shared by the proxy and the server.
 * Holding it proves nothing by itself: the server checks its signature before
 * treating anyone as in the demo (`./demo.ts`). The proxy only looks at its
 * shape, to decide whether a page load should go to sign in.
 */

export const DEMO_COOKIE = "reachout-demo";

/** A visit's worth: the demo's records live only in the server's memory anyway. */
const DEMO_MAX_AGE_S = 12 * 60 * 60;

export const DEMO_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: DEMO_MAX_AGE_S,
} as const;

/** `<32 hex>.<43 base64url>`: a demo id the server issued, and its signature. */
const SHAPE = /^[0-9a-f]{32}\.[A-Za-z0-9_-]{43}$/;

/** The cookie has the demo's shape. Not proof: only the server can check the signature. */
export function looksLikeDemo(value: string | undefined): boolean {
  return value !== undefined && SHAPE.test(value);
}
