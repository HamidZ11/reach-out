import type { Metadata } from "next";
import { connection } from "next/server";
import { SECTIONS } from "@/features/sections";
import { Settings } from "@/features/settings/settings";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { getRepository } from "@/server/repository";

export const metadata: Metadata = { title: SECTIONS.settings.label };

/** Settings, read through the Repository: the signed-in user's profile and goals. */
export default async function SettingsPage() {
  await connection(); // per request: the signed-in user's own profile
  const workspace = await loadWorkspace(await getRepository(), new Date());
  return <Settings workspace={workspace} />;
}
