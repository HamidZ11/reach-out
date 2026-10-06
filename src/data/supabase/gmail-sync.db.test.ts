import { gmailSyncContract } from "@/test/gmail-sync-contract";
import { bootstrappedAccount } from "@/test/supabase-accounts";

/** The same Gmail sync contract as in memory, with the real database underneath (Google faked). */
gmailSyncContract("Supabase", async () => (await bootstrappedAccount()).repository);
