import { redirect } from "next/navigation";

/**
 * There is no landing page. Once onboarding state is persisted, users who have
 * not finished onboarding are sent to /onboarding instead.
 */
export default function RootPage() {
  redirect("/today");
}
