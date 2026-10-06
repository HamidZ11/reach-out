// @vitest-environment node
import { describe, expect, it } from "vitest";
import { observedEmail } from "./messages";

const message = (labelIds: string[], headers: Record<string, string>) => ({
  id: "18c2a1f0b3e4",
  threadId: "18c2a1f0b3e4",
  labelIds,
  internalDate: String(Date.parse("2026-10-06T10:00:00Z")),
  payload: { headers: Object.entries(headers).map(([name, value]) => ({ name, value })) },
});

describe("a Gmail message as the domain sees it", () => {
  it("who, when, what, and whether you sent it", () => {
    expect(
      observedEmail(
        message(["SENT"], {
          From: "Kofi Asante <kofi@gmail.example>",
          To: '"Priya N" <Priya@Halden.example>',
          Cc: "ops@halden.example",
          Subject: "  Your summer internship ",
        }),
      ),
    ).toEqual({
      providerMessageId: "18c2a1f0b3e4",
      threadId: "18c2a1f0b3e4",
      outgoing: true,
      from: ["kofi@gmail.example"],
      to: ["priya@halden.example"],
      cc: ["ops@halden.example"],
      bcc: [],
      subject: "Your summer internship",
      sentAt: "2026-10-06T10:00:00.000Z",
    });
  });

  it("unsent drafts, spam, trash and chat never become history", () => {
    for (const label of ["DRAFT", "SPAM", "TRASH", "CHAT"]) {
      expect(observedEmail(message([label, "INBOX"], { From: "a@b.example" }))).toBeNull();
    }
  });
});
