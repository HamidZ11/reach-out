"use client";

import { useEffect } from "react";
import * as Icon from "@/components/icons";
import s from "@/features/onboarding/onboarding.module.css";
import a from "@/features/sign-in/sign-in.module.css";
import t from "@/features/today/today.module.css";

/**
 * When a page can't load (the database is unreachable, or this deployment
 * isn't configured), say so calmly in the sign-in frame, without the error's
 * details, and offer to try again. Nothing is shown as saved that wasn't.
 */
export default function PageError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("A page couldn't load", error.digest ?? error.name);
  }, [error]);
  return (
    <div className={s.page}>
      <div className={s.shell}>
        <header className={`${s.top} ${a.top}`}>
          <span className={`${s.brand} ${a.brand}`}>
            <span className={s.mark} aria-hidden="true">
              r
            </span>
            Reachout
          </span>
        </header>
        <main className={`${s.sheet} ${a.sheet}`}>
          <div className={s.flow}>
            <div className={s.scroller}>
              <div className={s.step}>
                <h1 className={s.question}>Reachout can&apos;t load this right now</h1>
                <p className={s.hint}>
                  Something went wrong on our side, not yours. Try again in a moment.
                </p>
              </div>
            </div>
            <div className={s.foot}>
              <button
                type="button"
                className={`${t.primary} ${s.continue}`}
                onClick={() => retry()}
              >
                Try again
                <Icon.ArrowRight size={16} weight={2} />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
