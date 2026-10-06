// @vitest-environment node
import { createMemoryRepository } from "@/data/memory/memory-repository";
import { UserIdSchema } from "@/domain/ids";
import { buildUser } from "@/test/builders";
import { gmailSyncContract } from "@/test/gmail-sync-contract";

gmailSyncContract("In memory", async () => {
  const id = UserIdSchema.parse(crypto.randomUUID());
  return createMemoryRepository(
    {
      users: [buildUser({ id, email: "kofi@student.example" })],
      companies: [],
      people: [],
      opportunities: [],
      interactions: [],
      drafts: [],
      nextActions: [],
      sourceFacts: [],
      interpretations: [],
    },
    id,
  );
});
