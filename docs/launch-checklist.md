# Launch checklist: auth and persistence

What the live Supabase project and the deployment need before real students sign in. Nothing here has been done or checked yet: everything so far has run against the local Supabase stack (`pnpm db:start`).

## Supabase project

- [ ] Create separate projects for preview and production. Previews never point at production data.
- [ ] Set spend limits, and check the plan's backups (daily backups at least; point-in-time recovery if the plan allows).
- [ ] Apply the migrations with `pnpm exec supabase link` and `pnpm exec supabase db push`, never through the dashboard.
- [ ] Run the pgTAP suite against the **preview** project (`pnpm exec supabase test db --linked`; it runs inside a rolled-back transaction): every public table has RLS and policies; `anon` has no grants; `authenticated` has `SELECT` only; the write functions are owned by `reachout_writer`.
- [ ] Confirm that `reachout_writer` exists and has `rolbypassrls = false` and `rolcanlogin = false`.

## Auth

- [ ] **Site URL:** the production origin (for example `https://reachout.example`).
- [ ] **Redirect allow-list:** exactly `https://<production-origin>/auth/confirm`, plus each preview origin's `/auth/confirm` in the preview project. No wildcards on the production project.
- [ ] **Email templates:** the magic link and confirmation templates must link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. Copy them from `supabase/templates/sign-in.html`. Without this, links only work in the browser that asked for them.
- [ ] **Providers:** email only. Anonymous sign-ins off. Phone off. No OAuth providers.
- [ ] **Sign-up policy:** decide whether anyone may sign up, or only invited addresses during the pilot (Auth › Sign up). The app doesn't decide this.
- [ ] **SMTP:** set a real SMTP provider. Supabase's built-in sender is rate-limited and not for production. Set the sender name to "Reachout".
- [ ] **Rate limits:** review Auth's email and verification limits. Reachout requests links from its server, so Supabase sees the server's IP, not the student's: per-IP limits apply to everyone at once. Consider CAPTCHA (Turnstile or hCaptcha) on sign-in before opening sign-up widely; it needs a small UI addition.
- [ ] **Sessions:** JWT expiry (default 1 hour) and refresh token rotation (on) are fine. Turn on asymmetric JWT signing keys if available, so the server verifies sessions without a round trip.

## Deployment

- [ ] Environment variables (server-only; not `NEXT_PUBLIC_`): `SUPABASE_URL` (https) and `SUPABASE_PUBLISHABLE_KEY`. Never set `REACHOUT_DEV_SEED`: production refuses to start serving with it. No service key is needed.
- [ ] Serve over https only. Session cookies are `Secure`, `HttpOnly` and `SameSite=Lax` in production.
- [ ] After deploying, check that a signed-out request to `/today` redirects to `/sign-in`, and that an unconfigured preview fails closed (an error page, no data).

## Live verification (not done yet)

- [ ] Sign in by email link on a phone and on a desktop, opening the link on the other device.
- [ ] Complete onboarding; reload; Today shows the saved first step.
- [ ] Draft → approve → edit (approval resets) → approve → mark sent; reload; the history has one sent message.
- [ ] **Two-account isolation smoke test:** account A cannot see account B's people, opportunities, drafts, history, actions, companies or facts. Check deep links with B's ids from A's session, and direct Data API calls with A's token: reads come back empty, and writes are refused (`42501`).
- [ ] Sign out; the session cookie is cleared; `/today` asks you to sign in again.

## Not built yet (by decision)

- Account deletion (Settings says "Not available yet").
- Changing the sign-in email (Settings shows it read-only).
- Gmail (phase 7) and AI (phase 9).
