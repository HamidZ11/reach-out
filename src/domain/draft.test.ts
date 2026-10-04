import { describe, expect, it } from "vitest";
import { buildDraft } from "@/test/builders";
import { approveDraft, discardDraft, markDraftSent, reviseDraft } from "./draft";
import { InteractionIdSchema } from "./ids";
import { instant } from "./time";

const AT = instant("2026-03-10T09:00:00Z");
const INTERACTION = InteractionIdSchema.parse("int_sent");

describe("draft approval", () => {
  it("cannot send a draft that has not been approved", () => {
    expect(() => markDraftSent(buildDraft(), INTERACTION, AT)).toThrow(
      expect.objectContaining({ code: "draft_not_approved" }),
    );
  });

  it("sends an approved draft and links it to the interaction it became", () => {
    const sent = markDraftSent(approveDraft(buildDraft(), AT), INTERACTION, AT);
    expect(sent).toMatchObject({ status: "sent", sentInteractionId: "int_sent", sentAt: AT });
  });

  it("requires a subject before an email can be approved", () => {
    const noSubject = buildDraft({ subject: undefined });
    expect(() => approveDraft(noSubject, AT)).toThrow(
      expect.objectContaining({ code: "email_subject_required" }),
    );
    expect(approveDraft(buildDraft({ channel: "linkedin", subject: undefined }), AT).status).toBe(
      "approved",
    );
  });

  it("returns an approved draft to approval when its content changes", () => {
    const revised = reviseDraft(approveDraft(buildDraft(), AT), { body: "New wording" }, AT);
    expect(revised.status).toBe("awaiting_approval");
    expect(revised.body).toBe("New wording");
    expect(revised).not.toHaveProperty("approvedAt");
  });

  it("cannot revise or discard a draft that has been sent", () => {
    const sent = markDraftSent(approveDraft(buildDraft(), AT), INTERACTION, AT);
    expect(() => reviseDraft(sent, { body: "Too late" }, AT)).toThrow(
      expect.objectContaining({ code: "draft_not_editable" }),
    );
    expect(() => discardDraft(sent, AT)).toThrow(
      expect.objectContaining({ code: "draft_not_editable" }),
    );
  });
});
