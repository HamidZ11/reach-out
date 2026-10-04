import type { ReactNode } from "react";

/**
 * The signed-in application area: Today, People, Opportunities, Outreach,
 * Companies and Settings. The application shell (navigation, account menu)
 * belongs here once the design phase has defined it — not before.
 *
 * Access control does not live in this layout. Layouts do not re-run on
 * navigation, so every data read is checked in the data access layer instead
 * (`getRepository` → `requireSession`). See ARCHITECTURE.md › Authentication.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return children;
}
