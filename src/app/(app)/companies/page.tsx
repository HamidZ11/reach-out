import type { Metadata } from "next";
import { RoutePlaceholder } from "@/components/route-placeholder";
import { SECTIONS } from "@/features/sections";

const section = SECTIONS.companies;

export const metadata: Metadata = { title: section.label };

export default function CompaniesPage() {
  return <RoutePlaceholder title={section.label} question={section.question} />;
}
