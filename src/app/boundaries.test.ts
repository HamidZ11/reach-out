import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Production code reads records only through the Repository and never depends
 * on the disposable design prototypes. ESLint enforces this on aliased imports;
 * this also catches relative paths.
 */

const root = join(process.cwd(), "src");
const PRODUCTION = ["features", "components", "server", "app", "data", "proxy.ts"];

function sources(dir: string): string[] {
  if (statSync(dir).isFile()) return [dir];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "prototypes" ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const imports = (file: string) =>
  [...readFileSync(file, "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1] ?? "");

describe("production boundaries", () => {
  const files = PRODUCTION.flatMap((dir) => sources(join(root, dir)));

  it("finds production sources to check", () => {
    expect(files.some((f) => f.endsWith(join("features", "today", "today.tsx")))).toBe(true);
    expect(files.some((f) => f.endsWith(join("features", "people", "people.tsx")))).toBe(true);
    expect(files.some((f) => f.endsWith(join("app", "(app)", "people", "page.tsx")))).toBe(true);
    expect(files.some((f) => f.endsWith(join("features", "pursuing", "pursuing.tsx")))).toBe(true);
    expect(files.some((f) => f.endsWith(join("app", "(app)", "opportunities", "page.tsx")))).toBe(
      true,
    );
    expect(files.some((f) => f.endsWith(join("features", "outreach", "outreach.tsx")))).toBe(true);
    expect(files.some((f) => f.endsWith(join("app", "(app)", "outreach", "page.tsx")))).toBe(true);
    expect(files.some((f) => f.endsWith(join("features", "companies", "companies.tsx")))).toBe(
      true,
    );
    expect(files.some((f) => f.endsWith(join("app", "(app)", "companies", "page.tsx")))).toBe(true);
    expect(files.some((f) => f.endsWith(join("features", "settings", "settings.tsx")))).toBe(true);
    expect(files.some((f) => f.endsWith(join("app", "(app)", "settings", "page.tsx")))).toBe(true);
    expect(files.some((f) => f.endsWith(join("features", "onboarding", "onboarding.tsx")))).toBe(
      true,
    );
    expect(files.some((f) => f.endsWith(join("app", "onboarding", "page.tsx")))).toBe(true);
  });

  it("features, components and routes never import seed data", () => {
    const offenders = files
      .filter((f) => !/^(server|data)\//.test(relative(root, f)))
      .filter((f) => imports(f).some((i) => i.includes("data/seed")));
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });

  it("nothing in production imports the design prototypes", () => {
    const offenders = files.filter((f) => imports(f).some((i) => i.includes("prototypes")));
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });

  it("production routes pass Server Actions, never the session-only local actions", () => {
    const offenders = files
      .filter((f) => relative(root, f).startsWith("app"))
      .filter((f) =>
        imports(f).some((i) => i.includes("local-actions") || i.includes("data/memory")),
      );
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });

  it("only the data and server layers talk to Supabase", () => {
    const offenders = files
      .filter((f) => !/^(data|server)\//.test(relative(root, f)))
      .filter((f) => relative(root, f) !== "proxy.ts")
      .filter((f) => imports(f).some((i) => i.startsWith("@supabase/")))
      // The confirm route only names Supabase's link types.
      .filter((f) => !relative(root, f).endsWith(join("auth", "confirm", "route.ts")));
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });

  it("the service key is never read by application code", () => {
    const offenders = files.filter((f) =>
      /SERVICE_ROLE|SECRET_KEY|service_role/.test(readFileSync(f, "utf8")),
    );
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });
});
