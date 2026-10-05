import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import type { SectionId } from "@/features/sections";
import { SECTIONS } from "@/features/sections";
import CompaniesPage from "./(app)/companies/page";
import OutreachPage from "./(app)/outreach/page";
import SettingsPage from "./(app)/settings/page";
import OnboardingPage from "./onboarding/page";

/** Sections still served by the placeholder. Today, People and Pursuing are built (see src/features). */
const pages: Record<Exclude<SectionId, "today" | "people" | "opportunities">, ComponentType> = {
  onboarding: OnboardingPage,
  outreach: OutreachPage,
  companies: CompaniesPage,
  settings: SettingsPage,
};

describe("route scaffold", () => {
  it.each(Object.entries(pages))("/%s still renders its section placeholder", (id, Page) => {
    render(<Page />);
    const { label } = SECTIONS[id as SectionId];
    expect(screen.getByRole("heading", { level: 1, name: label })).toBeInTheDocument();
  });
});
