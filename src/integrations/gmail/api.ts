import "server-only";
import type { Http } from "./http";
import { GmailError, json, request } from "./http";

/**
 * The three Gmail API reads Reachout needs, with the gmail.metadata scope:
 * the mailbox's address and history position, what was added since a
 * position, and one message's headers. Nothing else is read, and nothing is
 * ever written.
 */

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailMessageRef = { id: string; threadId?: string; labelIds?: string[] };

export type GmailHistoryPage = {
  /** Each change, oldest first: its own history id and the messages it added. */
  records: { id: string; added: GmailMessageRef[] }[];
  nextPageToken?: string;
  /** The mailbox's current position, once every page is read. */
  historyId: string;
};

export type GmailMessage = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: { headers?: { name: string; value: string }[] };
};

export type GmailApi = {
  profile(): Promise<{ emailAddress: string; historyId: string }>;
  history(startHistoryId: string, pageToken?: string): Promise<GmailHistoryPage>;
  /** One message's headers, or null if it has gone since. */
  message(id: string): Promise<GmailMessage | null>;
};

const ID = /^[A-Za-z0-9_-]{1,128}$/;

export function gmailApi(http: Http, accessToken: string): GmailApi {
  const get = (path: string) =>
    request(http, `${BASE}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });

  return {
    async profile() {
      const body = await json<{ emailAddress?: string; historyId?: string }>(await get("/profile"));
      if (!body.emailAddress || !body.historyId) throw new GmailError("unavailable", "No profile");
      return { emailAddress: body.emailAddress, historyId: body.historyId };
    },
    async history(startHistoryId, pageToken) {
      const params = new URLSearchParams({
        startHistoryId,
        historyTypes: "messageAdded",
        maxResults: "500",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const body = await json<{
        history?: { id: string; messagesAdded?: { message: GmailMessageRef }[] }[];
        nextPageToken?: string;
        historyId?: string;
      }>(await get(`/history?${params}`), "history_expired");
      return {
        records: (body.history ?? []).map((record) => ({
          id: record.id,
          added: (record.messagesAdded ?? []).map((m) => m.message).filter((m) => ID.test(m.id)),
        })),
        nextPageToken: body.nextPageToken,
        historyId: body.historyId ?? startHistoryId,
      };
    },
    async message(id) {
      if (!ID.test(id)) return null;
      const params = new URLSearchParams({ format: "metadata" });
      for (const header of ["From", "To", "Cc", "Bcc", "Subject"]) {
        params.append("metadataHeaders", header);
      }
      const response = await get(`/messages/${id}?${params}`);
      if (response.status === 404) return null;
      return json<GmailMessage>(response);
    },
  };
}
