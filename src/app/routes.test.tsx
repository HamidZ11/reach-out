import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import type { SectionId } from "@/features/sections";
import { SECTIONS } from "@/features/sections";
import CompaniesPage from "./(app)/companies/page";
import OpportunitiesPage from "./(app)/opportunities/page";
import OutreachPage from "./(app)/outreach/page";
import PeoplePage from "./(app)/people/page";
import SettingsPage from "./(app)/settings/page";
import OnboardingPage from "./onboarding/page";

/** Sections still served by the placeholder. Today is built (see src/features/today). */
const pages: Record<Exclude<SectionId, "today">, ComponentType> = {
  onboarding: OnboardingPage,
  people: PeoplePage,
  opportunities: OpportunitiesPage,
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
