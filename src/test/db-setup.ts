import { execFileSync } from "node:child_process";
import type { TestProject } from "vitest/node";

/** The local Supabase the database tests run against, from `supabase status`. */
export type LocalSupabase = { url: string; publishableKey: string; serviceRoleKey: string };

declare module "vitest" {
  export interface ProvidedContext {
    supabase: LocalSupabase;
  }
}

export default function setup(project: TestProject) {
  let status: Record<string, string>;
  try {
    status = JSON.parse(
      execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    throw new Error("The local Supabase isn't running. Start it with `pnpm db:start`.");
  }
  const url = status.API_URL;
  const publishableKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
  const serviceRoleKey = status.SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !serviceRoleKey) {
    throw new Error("`supabase status` didn't report the API URL and keys.");
  }
  project.provide("supabase", { url, publishableKey, serviceRoleKey });
}
