"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { RepositoryError } from "@/data/repository";
import type { OnboardingOutcome } from "@/features/onboarding/complete";
import { completeOnboardingStep, OnboardingInput } from "@/features/onboarding/complete";
import { getRepository } from "@/server/repository";

/**
 * Finishing onboarding for the signed-in user (never one named in the input).
 * The records are saved all at once and only once: a second submission is
 * refused, and nothing is reported as done until it is saved.
 */
export async function completeOnboarding(
  input: z.input<typeof OnboardingInput>,
): Promise<OnboardingOutcome> {
  const parsed = OnboardingInput.safeParse(input);
  if (!parsed.success) return { ok: false, problem: "invalid" };
  try {
    return await completeOnboardingStep(await getRepository(), parsed.data, new Date());
  } catch (error) {
    unstable_rethrow(error); // a redirect to sign in, from requireSession
    if (error instanceof RepositoryError) {
      if (error.code === "unauthenticated") redirect("/sign-in");
      console.error("Onboarding couldn't reach the data source", error.code);
      return { ok: false, problem: "unavailable" };
    }
    throw error;
  }
}
