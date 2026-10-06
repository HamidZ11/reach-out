import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SectionId } from "@/features/sections";
import { SECTIONS } from "@/features/sections";

/**
 * Every section is a built screen now, not a placeholder. Each route reads
 * through `getRepository()` (and so `requireSession()`), per request: in
 * production they all fail closed until accounts arrive. Vitest can't render
 * async Server Components, so this reads the route files themselves.
 */

const ROUTE_FILE: Record<SectionId, string> = {
  onboarding: "onboarding/page.tsx",
  today: "(app)/today/page.tsx",
  people: "(app)/people/page.tsx",
  opportunities: "(app)/opportunities/page.tsx",
  outreach: "(app)/outreach/page.tsx",
  companies: "(app)/companies/page.tsx",
  settings: "(app)/settings/page.tsx",
};

describe("routes", () => {
  it.each(Object.entries(ROUTE_FILE))(
    "%s reads through the Repository, per request",
    (id, file) => {
      const source = readFileSync(join(process.cwd(), "src", "app", file), "utf8");
      expect(source).toContain("await getRepository()");
      expect(source).toContain("await connection()");
      expect(source).not.toContain("RoutePlaceholder");
      expect(SECTIONS[id as SectionId].href).toBeTruthy();
    },
  );
});
