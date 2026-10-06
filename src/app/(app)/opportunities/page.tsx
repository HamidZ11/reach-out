import type { Metadata } from "next";
import { connection } from "next/server";
import { Pursuing } from "@/features/pursuing/pursuing";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { getRepository } from "@/server/repository";
import { workspaceActions } from "../workspace-actions";

/** The route stays /opportunities; the product calls it Pursuing (DESIGN.md › Navigation). */
export const metadata: Metadata = { title: "Pursuing" };

/** Pursuing, read through the Repository, with the research context an opportunity shows. */
export default async function OpportunitiesPage() {
  await connection(); // per request: grouping and status depend on the date and the records
  const workspace = await loadWorkspace(await getRepository(), new Date(), { research: true });
  return <Pursuing workspace={workspace} actions={workspaceActions} />;
}
