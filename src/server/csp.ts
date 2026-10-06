import "server-only";

/**
 * Scripts only from Reachout, and only with this response's nonce
 * (`strict-dynamic` lets them load their own chunks). No framing, no plugins,
 * forms only to Reachout. Styles allow inline attributes, which two components
 * use for CSS variables. Development adds `unsafe-eval` for React's tooling.
 */
export function contentSecurityPolicy(nonce: string, https: boolean): string {
  const development = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
