/**
 * Where to go after signing in: only ever a path inside Reachout. Anything
 * that could leave the site (`//evil.example`, `https://…`, `/\evil`) or loop
 * back into sign-in becomes the default, so a crafted link can't redirect
 * anyone elsewhere.
 */
export const DEFAULT_NEXT = "/";

const ORIGIN = "https://reachout.invalid";

export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return DEFAULT_NEXT;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return DEFAULT_NEXT;
  // Control characters (including tabs and newlines) never belong in a path.
  if ([...value].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f))
    return DEFAULT_NEXT;
  let url: URL;
  try {
    url = new URL(value, ORIGIN);
  } catch {
    return DEFAULT_NEXT;
  }
  if (url.origin !== ORIGIN) return DEFAULT_NEXT;
  if (url.pathname === "/sign-in" || url.pathname.startsWith("/auth/")) return DEFAULT_NEXT;
  return `${url.pathname}${url.search}`;
}
