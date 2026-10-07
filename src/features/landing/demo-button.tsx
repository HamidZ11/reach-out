"use client";

import { useFormStatus } from "react-dom";
import * as Icon from "@/components/icons";
import t from "@/features/today/today.module.css";

/** "Try the demo", in its form: it says so while the demo opens. */
export function DemoButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={t.primary} disabled={pending}>
      {pending ? "Opening the demo…" : "Try the demo"}
      {!pending && <Icon.ArrowRight size={16} weight={2} />}
    </button>
  );
}
