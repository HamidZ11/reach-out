import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Database tests: the real local Supabase (Postgres, row-level security, the
 * workflow functions, and Auth). Run with `pnpm test:db` after
 * `pnpm db:start`; they fail, rather than skip, if it isn't running.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    globalSetup: ["./src/test/db-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
