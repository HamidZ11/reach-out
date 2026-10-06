import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import type { SectionId } from "@/features/sections";
import { SECTIONS } from "@/features/sections";
import SettingsPage from "./(app)/settings/page";
import OnboardingPage from "./onboarding/page";

/** Sections still served by the placeholder. Settings and Onboarding are not built yet (see src/features). */
const pages: Record<
  Exclude<SectionId, "today" | "people" | "opportunities" | "outreach" | "companies">,
  ComponentType
> = {
  onboarding: OnboardingPage,
  settings: SettingsPage,
};

describe("route scaffold", () => {
  it.each(Object.entries(pages))("/%s still renders its section placeholder", (id, Page) => {
    render(<Page />);
    const { label } = SECTIONS[id as SectionId];
    expect(screen.getByRole("heading", { level: 1, name: label })).toBeInTheDocument();
  });
});
