import "server-only";

/**
 * How the Gmail adapter talks to Google: an injectable fetch (tests pass a
 * fake), a timeout on every request, and provider failures reduced to the
 * few kinds Reachout acts on. Provider messages and tokens never travel in
 * these errors.
 */

export type Http = typeof fetch;

/** Every call to Google gives up after this long. */
export const GOOGLE_TIMEOUT_MS = 8_000;

export type GmailErrorKind =
  /** The grant is gone (revoked, expired, or the account changed): reconnect. */
  | "revoked"
  /** Access was narrowed: the needed scope isn't granted any more. */
  | "permission"
  /** The history cursor is too old for Gmail to continue from. */
  | "history_expired"
  /** Google asked us to slow down. */
  | "rate_limited"
  /** Google couldn't be reached or answered unexpectedly. */
  | "unavailable";

export class GmailError extends Error {
  readonly kind: GmailErrorKind;

  constructor(kind: GmailErrorKind, message: string = kind) {
    super(message);
    this.name = "GmailError";
    this.kind = kind;
  }
}

/** A request with a timeout; network failures and timeouts become "unavailable". */
export async function request(
  http: Http,
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  try {
    return await http(input, { ...init, signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS) });
  } catch {
    throw new GmailError("unavailable", "Google could not be reached");
  }
}

/** The JSON body of a successful response, or the error kind it means. */
export async function json<T>(response: Response, onNotFound?: GmailErrorKind): Promise<T> {
  if (response.ok) return (await response.json()) as T;
  const body = (await response.json().catch(() => ({}))) as {
    error?: string | { status?: string; errors?: { reason?: string }[] };
  };
  const reason =
    typeof body.error === "string"
      ? body.error
      : (body.error?.errors?.[0]?.reason ?? body.error?.status ?? "");
  if (response.status === 400 && reason === "invalid_grant") throw new GmailError("revoked");
  if (response.status === 401) throw new GmailError("revoked");
  if (response.status === 404 && onNotFound) throw new GmailError(onNotFound);
  if (response.status === 429 || /rateLimitExceeded/i.test(reason)) {
    throw new GmailError("rate_limited");
  }
  if (response.status === 403) throw new GmailError("permission");
  throw new GmailError("unavailable", `Google answered ${response.status}`);
}
