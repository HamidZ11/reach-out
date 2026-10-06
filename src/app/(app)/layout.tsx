import { redirect } from "next/navigation";
import { connection } from "next/server";
import { calendarDateIn } from "@/domain/time";
import { AppShell } from "@/features/shell/app-shell";
import { loadToday } from "@/features/today/load-today";
import { getRepository } from "@/server/repository";

/**
 * The signed-in application area, inside the approved shell (DESIGN.md ›
 * Navigation): the labelled rail on desktop, the four-tab bar on phones.
 *
 * Access control does not live in this layout. Layouts do not re-run on
 * navigation, so every read and write is checked in the data access layer
 * instead (`getRepository` → `requireSession`). See ARCHITECTURE.md ›
 * Authentication. The onboarding redirect here is routing only.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  await connection(); // per request: the shell shows the signed-in user's state
  const repository = await getRepository();
  const user = await repository.user.get();
  // Routing, not security: the app starts once onboarding has set it up.
  if (!user.onboardingCompletedAt) redirect("/onboarding");
  const items = await loadToday(repository, calendarDateIn(new Date(), user.timeZone));
  return (
    <AppShell userName={user.name} attention={items.length > 0}>
      {children}
    </AppShell>
  );
}
