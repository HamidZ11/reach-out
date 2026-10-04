import { describe, expect, it } from "vitest";
import { buildPerson } from "@/test/builders";
import type { InteractionKind } from "./interaction";
import type { RelationshipStatus } from "./person";
import { relationshipStatusAfter } from "./person";

describe("relationshipStatusAfter", () => {
  it.each<[RelationshipStatus, InteractionKind, RelationshipStatus]>([
    ["new", "message_sent", "contacted"],
    ["dormant", "message_sent", "contacted"],
    ["replied", "message_sent", "replied"],
    ["new", "message_received", "replied"],
    ["contacted", "message_received", "replied"],
    ["dormant", "meeting", "replied"],
    ["contacted", "meeting", "replied"],
    ["new", "note", "new"],
  ])("%s + %s → %s", (current, interaction, expected) => {
    expect(relationshipStatusAfter(current, interaction)).toBe(expected);
  });

  it("never changes warm, which only the user sets", () => {
    const kinds: InteractionKind[] = ["message_sent", "message_received", "meeting", "note"];
    for (const kind of kinds) expect(relationshipStatusAfter("warm", kind)).toBe("warm");
  });
});

describe("PersonSchema", () => {
  it("requires a role or a company for context", () => {
    expect(() => buildPerson({ role: undefined })).toThrow(/role or a company/);
    expect(buildPerson({ role: undefined, companyId: "cmp_test" }).companyId).toBe("cmp_test");
  });

  it("only accepts LinkedIn URLs on linkedin.com", () => {
    expect(() => buildPerson({ linkedinUrl: "https://example.com/in/someone" })).toThrow();
    expect(buildPerson({ linkedinUrl: "https://www.linkedin.com/in/someone" }).linkedinUrl).toBe(
      "https://www.linkedin.com/in/someone",
    );
  });
});
