import { useState } from "react";
import type { ItemContext } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import { stableKey } from "./wording";

/**
 * Which Today item is in focus. It follows the domain's order; choosing or
 * skipping an item only changes what is shown first, never the ranking.
 */
export function useFocus(day: WorkspaceState) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const contexts = day.contexts;
  const current =
    contexts.find((c) => stableKey(c) === chosen) ??
    contexts.find((c) => !skipped.includes(stableKey(c))) ??
    contexts[0];
  const index = current ? contexts.indexOf(current) : -1;
  const next = contexts.filter((c) => c !== current && !skipped.includes(stableKey(c)))[0];
  return {
    current,
    next,
    position: index + 1,
    choose: (ctx: ItemContext) => setChosen(stableKey(ctx)),
    step: (delta: number) => {
      const target = contexts[index + delta];
      if (target) setChosen(stableKey(target));
    },
    skip: () => {
      if (!current) return;
      const remaining = contexts.filter((c) => c !== current && !skipped.includes(stableKey(c)));
      setSkipped(remaining.length ? [...skipped, stableKey(current)] : []);
      setChosen(null);
    },
  };
}

export type Focus = ReturnType<typeof useFocus>;
