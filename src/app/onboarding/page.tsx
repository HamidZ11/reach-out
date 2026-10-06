import type { Metadata } from "next";
import { connection } from "next/server";
import { loadOnboarding } from "@/features/onboarding/load-onboarding";
import { Onboarding } from "@/features/onboarding/onboarding";
import { SECTIONS } from "@/features/sections";
import { getRepository } from "@/server/repository";

export const metadata: Metadata = { title: SECTIONS.onboarding.label };

/**
 * Onboarding for the signed-in user. It reads the session through
 * `getRepository()`, so in production it fails closed until accounts arrive;
 * in development it runs as the seed user. What it builds lasts for the session.
 */
export default async function OnboardingPage() {
  await connection(); // per request: the signed-in user and their day
  const base = await loadOnboarding(await getRepository(), new Date());
  return <Onboarding base={base} />;
}
