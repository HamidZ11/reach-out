import { UserIdSchema } from "@/domain/ids";
import { buildUser } from "@/test/builders";
import { repositoryContract } from "@/test/repository-contract";
import { createMemoryRepository } from "./memory-repository";

repositoryContract("In memory", async () => {
  const id = UserIdSchema.parse(crypto.randomUUID());
  return createMemoryRepository(
    {
      users: [buildUser({ id, name: "Kofi", email: "kofi@student.example", timeZone: "UTC" })],
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
