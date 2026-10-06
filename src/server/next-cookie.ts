import "server-only";

/** Where to return after the sign-in link: set when it is sent, read once when it is opened. */
export const NEXT_COOKIE = "reachout-next";

export const NEXT_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/auth",
  maxAge: 60 * 60,
} as const;
