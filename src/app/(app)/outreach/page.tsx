import type { Metadata } from "next";
import { connection } from "next/server";
import { Outreach } from "@/features/outreach/outreach";
import { SECTIONS } from "@/features/sections";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { getRepository } from "@/server/repository";
import { workspaceActions } from "../workspace-actions";

export const metadata: Metadata = { title: SECTIONS.outreach.label };

/** Outreach, read through the Repository; tracks derive from the domain's outreach state. */
export default async function OutreachPage() {
  await connection(); // per request: outreach state depends on the date and the records
  const workspace = await loadWorkspace(await getRepository(), new Date());
  return <Outreach workspace={workspace} actions={workspaceActions} />;
}
