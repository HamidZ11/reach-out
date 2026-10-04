import type { Metadata } from "next";
import { RoutePlaceholder } from "@/components/route-placeholder";
import { SECTIONS } from "@/features/sections";

const section = SECTIONS.settings;

export const metadata: Metadata = { title: section.label };

export default function SettingsPage() {
  return <RoutePlaceholder title={section.label} question={section.question} />;
}
