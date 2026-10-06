import type { Repository } from "@/data/repository";
import { calendarDateIn, instant } from "@/domain/time";
import type { OnboardingBase } from "./build";

/**
 * What onboarding needs from the server: who is signed in and what day it is
 * for them. Read through the Repository, so it shares the auth boundary
 * (`getRepository` → `requireSession`): in production it fails closed until
 * accounts arrive. The caller supplies the clock.
 */
export async function loadOnboarding(repository: Repository, now: Date): Promise<OnboardingBase> {
  const user = await repository.user.get();
  return { now: instant(now.toISOString()), today: calendarDateIn(now, user.timeZone), user };
}
