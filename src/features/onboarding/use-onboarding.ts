import { useMemo, useState } from "react";
import type { Answers, StepId } from "./questions";
import { EMPTY, problemsFor, STEPS } from "./questions";

type ListField = "roles" | "sectors" | "locations";

/** Whether a step has what it needs to move on. */
export function canContinue(step: StepId, a: Answers): boolean {
  return problemsFor(step, a).length === 0;
}

/** Where you are in setup and what you've answered. Local state: nothing is saved. */
export function useOnboarding() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const step = STEPS[stepIndex] ?? "objective";

  return useMemo(
    () => ({
      step,
      stepIndex,
      answers,
      set: (patch: Partial<Answers>) => setAnswers((a) => ({ ...a, ...patch })),
      toggle: (field: ListField, value: string) =>
        setAnswers((a) => ({
          ...a,
          [field]: a[field].includes(value)
            ? a[field].filter((v) => v !== value)
            : [...a[field], value],
        })),
      next: () => {
        if (canContinue(step, answers)) setStepIndex(Math.min(stepIndex + 1, STEPS.length - 1));
      },
      back: () => setStepIndex(Math.max(0, stepIndex - 1)),
      goTo: (i: number) => setStepIndex(Math.min(Math.max(0, i), STEPS.length - 1)),
    }),
    [step, stepIndex, answers],
  );
}

export type Flow = ReturnType<typeof useOnboarding>;
