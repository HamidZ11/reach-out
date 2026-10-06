import { bootstrappedAccount } from "@/test/supabase-accounts";
import { repositoryContract } from "@/test/repository-contract";

/** The same contract as the in-memory repository, against the real database. */
repositoryContract("Supabase", async () => (await bootstrappedAccount()).repository);
