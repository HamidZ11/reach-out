import type { Metadata } from "next";
import { connection } from "next/server";
import { Companies } from "@/features/companies/companies";
import { SECTIONS } from "@/features/sections";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { getRepository } from "@/server/repository";

export const metadata: Metadata = { title: SECTIONS.companies.label };

/** Companies, gathered from the user's records through the Repository, with their sourced facts. */
export default async function CompaniesPage() {
  await connection(); // per request: what's active and who needs you depend on the date
  const workspace = await loadWorkspace(await getRepository(), new Date(), { research: true });
  return <Companies workspace={workspace} />;
}
