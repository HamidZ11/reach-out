import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Architecture boundaries (see ARCHITECTURE.md). Tests are exempt so they can
 * build fixtures from seed data directly.
 */
const restrictImports = (files, group, message) => ({
  files,
  ignores: ["**/*.test.ts", "**/*.test.tsx"],
  rules: {
    "no-restricted-imports": ["error", { patterns: [{ group, message }] }],
  },
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx,mts}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      eqeqeq: ["error", "always"],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  restrictImports(
    ["src/domain/**"],
    [
      "react",
      "react-dom",
      "react/*",
      "next",
      "next/*",
      "@/app/**",
      "@/components/**",
      "@/data/**",
      "@/features/**",
      "@/server/**",
    ],
    "The domain layer is pure TypeScript: no React, Next.js, data sources or app code.",
  ),
  restrictImports(
    ["src/data/**"],
    [
      "react",
      "react-dom",
      "next",
      "next/*",
      "@/app/**",
      "@/components/**",
      "@/features/**",
      "@/server/**",
    ],
    "The data layer implements the Repository; it must not depend on UI, features or server wiring.",
  ),
  restrictImports(
    ["src/features/**", "src/app/**"],
    ["@/data/seed", "@/data/seed/**"],
    "Features and routes must not know where records come from. Take a Repository, or call src/server.",
  ),
  restrictImports(
    ["src/components/**"],
    ["@/data/**", "@/server/**", "@/features/**"],
    "Shared components are presentational: no data access, server wiring or feature logic.",
  ),
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);

export default eslintConfig;
