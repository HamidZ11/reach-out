import type { Metadata } from "next";
import { connection } from "next/server";
import { People } from "@/features/people/people";
import { SECTIONS } from "@/features/sections";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { getRepository } from "@/server/repository";
import { workspaceActions } from "../workspace-actions";

export const metadata: Metadata = { title: SECTIONS.people.label };

/** People, read through the Repository, with the research context a person's page shows. */
export default async function PeoplePage() {
  await connection(); // per request: status depends on the date and the user's records
  const workspace = await loadWorkspace(await getRepository(), new Date(), { research: true });
  return <People workspace={workspace} actions={workspaceActions} />;
}
