import type { Metadata } from "next";
import { connection } from "next/server";
import { signOut } from "@/app/auth/actions";
import { SECTIONS } from "@/features/sections";
import { Settings } from "@/features/settings/settings";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { getSession } from "@/server/auth";
import { getRepository } from "@/server/repository";
import { settingsActions } from "../workspace-actions";

export const metadata: Metadata = { title: SECTIONS.settings.label };

/** Settings, read through the Repository: the signed-in user's profile and goals. */
export default async function SettingsPage() {
  await connection(); // per request: the signed-in user's own profile
  const workspace = await loadWorkspace(await getRepository(), new Date());
  const session = await getSession();
  const account =
    session?.method === "supabase"
      ? { email: session.email ?? workspace.user.email, signOut }
      : { email: workspace.user.email };
  return <Settings workspace={workspace} actions={settingsActions} account={account} />;
}
