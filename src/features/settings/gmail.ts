import type { GmailConnection } from "@/data/repository";

/**
 * Gmail in Settings (D-031): connect, check now, disconnect. Production passes
 * Server Actions; tests pass fakes. Connecting leaves for Google's consent
 * screen, so it only answers when it can't go.
 */
export type GmailOutcome =
  | { ok: true; connection: GmailConnection | null; message: string }
  | { ok: false; message: string };

export type GmailActions = {
  connect(): Promise<{ ok: false; message: string } | void>;
  check(): Promise<GmailOutcome>;
  disconnect(): Promise<GmailOutcome>;
};

export type GmailSettings = {
  /** Gmail is configured on this deployment. */
  available: boolean;
  connection: GmailConnection | null;
};

/** What Settings says after Google sends the user back (`/settings?gmail=…`). */
export const GMAIL_NOTICE: Record<string, string> = {
  connected: "Gmail connected. Reachout will notice what you send and receive from now on.",
  denied: "Gmail wasn't connected.",
  permission:
    "Gmail wasn't connected: Reachout needs permission to read message details. Try again and allow it.",
  invalid: "That didn't work. Start connecting Gmail again from here.",
  unavailable: "Gmail couldn't be connected just now. Try again in a moment.",
};
