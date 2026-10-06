import { z } from "zod";
import type { Repository } from "@/data/repository";
import { RepositoryError } from "@/data/repository";
import { PERSON_SOURCE_KINDS } from "@/domain/person";
import { calendarDateIn, instant, isValidTimeZone } from "@/domain/time";
import { ObjectiveSchema } from "@/domain/user";
import type { Problem } from "@/features/workspace/outcome";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import type { Workspace } from "@/features/workspace/records";
import { buildWorkspace } from "./build";
import type { Answers } from "./questions";
import { DUE_OPTIONS, problemsFor, STEPS } from "./questions";

/**
 * Finishing onboarding, on the server: the answers are checked again, become
 * domain records (`buildWorkspace`), and are saved all at once, exactly once.
 * Only then does the user see Today, read back from what was saved.
 */

const Label = z.string().trim().min(1).max(120);
const Text = (max: number) => z.string().max(max);

export const AnswersSchema = z.object({
  objective: ObjectiveSchema.optional(),
  roles: z.array(Label).max(30),
  sectors: z.array(Label).max(30),
  locations: z.array(Label).max(30),
  opportunityTitle: Text(200),
  organisation: Text(200),
  deadline: Text(10),
  opportunityUrl: Text(2000).optional(),
  personName: Text(200),
  personRole: Text(200),
  personCompany: Text(200).optional(),
  source: z.enum(PERSON_SOURCE_KINDS).optional(),
  whyRelevant: Text(2000).optional(),
  action: z.int().min(0).max(10).optional(),
  due: z.union(DUE_OPTIONS.map((o) => z.literal(o.days))),
}) satisfies z.ZodType<Answers>;

export const OnboardingInput = z.object({
  answers: AnswersSchema,
  /** The browser's time zone, so Today starts at the user's midnight. */
  timeZone: z.string().max(100),
});

export type OnboardingOutcome =
  { ok: true; workspace: Workspace } | { ok: false; problem: Problem };

export type CompleteOnboarding = (
  input: z.input<typeof OnboardingInput>,
) => Promise<OnboardingOutcome>;

export async function completeOnboardingStep(
  repository: Repository,
  input: z.infer<typeof OnboardingInput>,
  now: Date,
  newId?: () => string,
): Promise<OnboardingOutcome> {
  const { answers } = input;
  if (STEPS.some((step) => problemsFor(step, answers).length > 0)) {
    return { ok: false, problem: "invalid" };
  }
  try {
    const user = await repository.user.get();
    if (user.onboardingCompletedAt !== undefined)
      return { ok: false, problem: "onboarding_complete" };
    const timeZone = isValidTimeZone(input.timeZone) ? input.timeZone : user.timeZone;
    const built = buildWorkspace(
      answers,
      {
        now: instant(now.toISOString()),
        today: calendarDateIn(now, timeZone),
        user: { ...user, timeZone },
      },
      newId,
    );
    await repository.onboarding.complete({
      user: built.user,
      companies: built.companies,
      people: built.people,
      opportunities: built.opportunities,
      nextActions: built.nextActions,
    });
    return { ok: true, workspace: await loadWorkspace(repository, now) };
  } catch (error) {
    if (error instanceof RepositoryError) {
      if (error.code === "unauthenticated") throw error;
      return { ok: false, problem: error.code };
    }
    if (error instanceof z.ZodError) return { ok: false, problem: "invalid" };
    console.error("Completing onboarding failed", error);
    return { ok: false, problem: "unavailable" };
  }
}
