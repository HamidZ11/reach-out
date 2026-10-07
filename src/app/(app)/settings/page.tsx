import type { Metadata } from "next";
import { connection } from "next/server";
import { signOut } from "@/app/auth/actions";
import { exitDemo, resetDemo } from "@/app/demo/actions";
import { GMAIL_NOTICE } from "@/features/settings/gmail";
import { SECTIONS } from "@/features/sections";
import type { Account } from "@/features/settings/settings";
import { Settings } from "@/features/settings/settings";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { getSession } from "@/server/auth";
import { gmailStatus } from "@/server/gmail";
import { getRepository } from "@/server/repository";
import { gmailActions, settingsActions } from "../workspace-actions";

export const metadata: Metadata = { title: SECTIONS.settings.label };

/**
 * Settings, read through the Repository: the signed-in user's profile, goals
 * and Gmail. In the demo (D-035), Gmail is unavailable and Account offers
 * Reset demo and Exit demo.
 */
export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  await connection(); // per request: the signed-in user's own profile
  const repository = await getRepository();
  const [workspace, session, gmail, params] = await Promise.all([
    loadWorkspace(repository, new Date()),
    getSession(),
    gmailStatus(),
    searchParams,
  ]);
  const account: Account =
    session?.method === "supabase"
      ? { email: session.email ?? workspace.user.email, signOut }
      : session?.method === "demo"
        ? { demo: { reset: resetDemo, exit: exitDemo } }
        : { email: workspace.user.email };
  // Only the known outcomes are said; anything else in the address is ignored.
  const outcome = typeof params.gmail === "string" ? params.gmail : undefined;
  const notice =
    outcome && Object.hasOwn(GMAIL_NOTICE, outcome) ? GMAIL_NOTICE[outcome] : undefined;
  return (
    <Settings
      workspace={workspace}
      actions={settingsActions}
      account={account}
      gmail={gmail}
      gmailActions={gmailActions}
      notice={notice}
    />
  );
}
