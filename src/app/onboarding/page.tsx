import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { workspaceActions } from "@/app/(app)/workspace-actions";
import { loadOnboarding } from "@/features/onboarding/load-onboarding";
import { Onboarding } from "@/features/onboarding/onboarding";
import { SECTIONS } from "@/features/sections";
import { getRepository } from "@/server/repository";
import { completeOnboarding } from "./actions";

export const metadata: Metadata = { title: SECTIONS.onboarding.label };

/**
 * Onboarding for the signed-in user, read through `getRepository()` (so it
 * needs a session and fails closed without one). Once it is complete, this
 * address goes to Today.
 */
export default async function OnboardingPage() {
  await connection(); // per request: the signed-in user and their day
  const base = await loadOnboarding(await getRepository(), new Date());
  if (base.user.onboardingCompletedAt) redirect("/today");
  return <Onboarding base={base} complete={completeOnboarding} actions={workspaceActions} />;
}
