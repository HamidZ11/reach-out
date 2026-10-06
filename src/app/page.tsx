import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getRepository } from "@/server/repository";

/**
 * There is no landing page. Signed in, you go to Today once onboarding is
 * complete, and to onboarding until then; signed out, the proxy (and, behind
 * it, `getRepository`) sends you to sign in.
 */
export default async function RootPage() {
  await connection();
  const user = await (await getRepository()).user.get();
  redirect(user.onboardingCompletedAt ? "/today" : "/onboarding");
}
