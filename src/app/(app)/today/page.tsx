import type { Metadata } from "next";
import { connection } from "next/server";
import { SECTIONS } from "@/features/sections";
import { Today } from "@/features/today/today";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { getRepository } from "@/server/repository";

export const metadata: Metadata = { title: SECTIONS.today.label };

/** Today, read through the Repository and derived by the domain's rules. */
export default async function TodayPage() {
  await connection(); // per request: Today depends on the date and the user's records
  const workspace = await loadWorkspace(await getRepository(), new Date());
  return <Today workspace={workspace} />;
}
