"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import { endDemo, resetDemo as startOver, startDemo } from "@/server/demo";

/**
 * The demo workspace (D-035). Entering takes no account, email or Supabase:
 * the server signs a demo id into an httpOnly cookie, and the demo's records
 * live in its memory. Nothing a visitor sends chooses whose records they see.
 */

/** "Try the demo": into the fictional student's workspace, at Today. */
export async function enterDemo(): Promise<void> {
  await startDemo();
  redirect("/today");
}

/** Back to the demo as it started, at Today. Only ever this browser's own demo. */
export async function resetDemo(): Promise<void> {
  const session = await getSession();
  if (session?.method !== "demo") redirect("/");
  startOver(session.demoId);
  redirect("/today");
}

/** Leaves the demo, forgetting its changes, and returns to the landing page. */
export async function exitDemo(): Promise<void> {
  await endDemo();
  redirect("/");
}
