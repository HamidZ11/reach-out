import type { Metadata } from "next";
import { connection } from "next/server";
import { signOut } from "@/app/auth/actions";
import { GMAIL_NOTICE } from "@/features/settings/gmail";
import { SECTIONS } from "@/features/sections";
import { Settings } from "@/features/settings/settings";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { getSession } from "@/server/auth";
import { gmailStatus } from "@/server/gmail";
import { getRepository } from "@/server/repository";
import { gmailActions, settingsActions } from "../workspace-actions";

export const metadata: Metadata = { title: SECTIONS.settings.label };

/** Settings, read through the Repository: the signed-in user's profile, goals and Gmail. */
export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  await connection(); // per request: the signed-in user's own profile
  const repository = await getRepository();
  const [workspace, session, gmail, params] = await Promise.all([
    loadWorkspace(repository, new Date()),
    getSession(),
    gmailStatus(),
    searchParams,
  ]);
  const account =
    session?.method === "supabase"
      ? { email: session.email ?? workspace.user.email, signOut }
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
