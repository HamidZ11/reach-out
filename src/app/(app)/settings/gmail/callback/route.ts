import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { finishGmailConnection } from "@/server/gmail";

/**
 * Where Google sends the user back after the consent screen. Whatever
 * happened, they return to Settings, which says how it went. The destination
 * is fixed: nothing in the request can redirect anywhere else.
 */
export async function GET(request: NextRequest) {
  const result = await finishGmailConnection(request.nextUrl.searchParams);
  // Switched off: no flow exists, so there is nothing to report.
  if (result === "disabled") redirect("/settings");
  redirect(`/settings?gmail=${result}`);
}
