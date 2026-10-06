"use client";

import { useActionState, useState } from "react";
import * as Icon from "@/components/icons";
import s from "@/features/onboarding/onboarding.module.css";
import t from "@/features/today/today.module.css";
import a from "./sign-in.module.css";
import type { SignInState } from "./state";
import { SIGN_IN_IDLE } from "./state";

/**
 * Sign in, in onboarding's frame and type: one question, one field, one
 * action. The link arrives by email; nothing here is a password. Built from
 * the approved system (no new colours, faces or components); it still needs
 * the human's visual review.
 */
export function SignIn({
  next,
  linkFailed,
  request,
}: {
  /** Where to go once signed in: already checked to be a path inside Reachout. */
  next: string;
  /** The last link didn't work (expired, used, or opened elsewhere). */
  linkFailed: boolean;
  request: (previous: SignInState, form: FormData) => Promise<SignInState>;
}) {
  const [state, formAction, pending] = useActionState(request, SIGN_IN_IDLE);
  // "Use a different email" sets this answer aside; the next one shows as usual.
  const [dismissed, setDismissed] = useState<SignInState | null>(null);
  const sent = state.status === "sent" && state !== dismissed;
  const problem = state.status === "problem" ? state : undefined;
  const fieldProblem = problem?.field === "email" ? problem.message : undefined;

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
          {sent ? (
            <div className={s.flow}>
              <div className={s.scroller}>
                <div className={s.step}>
                  <h1 className={s.question}>Check your email</h1>
                  <p className={s.hint}>
                    We sent a sign-in link to <strong>{state.email}</strong>. It works once, for the
                    next hour. You can open it on this device or another.
                  </p>
                </div>
              </div>
              <div className={s.foot}>
                <button
                  type="button"
                  className={`${t.text} ${s.footBack}`}
                  onClick={() => setDismissed(state)}
                >
                  <Icon.ArrowLeft size={16} weight={2} />
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <form className={s.flow} action={formAction} noValidate>
              <div className={s.scroller}>
                <div className={s.step}>
                  <h1 className={s.question}>Sign in to Reachout</h1>
                  <p className={s.hint}>
                    We&apos;ll email you a link. No password, and the same link starts a new
                    account.
                  </p>
                  <div className={s.body}>
                    {linkFailed && !problem && (
                      <p className={s.message} role="status">
                        <span className={t.dot} data-tone="now" aria-hidden="true" />
                        That link has expired or was already used. Send yourself a new one.
                      </p>
                    )}
                    <div className={s.field}>
                      <label className={s.label} htmlFor="sign-in-email">
                        Email
                      </label>
                      <input
                        id="sign-in-email"
                        name="email"
                        type="email"
                        className={s.input}
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        enterKeyHint="send"
                        defaultValue={problem?.email ?? ""}
                        aria-invalid={fieldProblem ? true : undefined}
                        aria-describedby={fieldProblem ? "sign-in-email-problem" : undefined}
                        required
                      />
                      {fieldProblem && (
                        <p id="sign-in-email-problem" className={s.message}>
                          <span className={t.dot} data-tone="now" aria-hidden="true" />
                          {fieldProblem}
                        </p>
                      )}
                    </div>
                    {problem && !fieldProblem && (
                      <p className={s.message} role="alert">
                        <span className={t.dot} data-tone="now" aria-hidden="true" />
                        {problem.message}
                      </p>
                    )}
                    <input type="hidden" name="next" value={next} />
                  </div>
                </div>
              </div>
              <div className={s.foot}>
                <button type="submit" className={`${t.primary} ${s.continue}`} disabled={pending}>
                  {pending ? "Sending…" : "Email me a sign-in link"}
                  <Icon.ArrowRight size={16} weight={2} />
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
