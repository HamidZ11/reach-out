# Launch checklist

What the live Supabase project, Google Cloud and the deployment need before real students sign in. **Nothing here has been done or checked on hosted infrastructure yet.** Everything so far ran against the local Supabase stack (`pnpm db:start`), with Google faked in tests.

## Status (2026-10-07)

**Done locally and verified:**

- the full product, auth and persistence;
- RLS and two-account isolation (`pnpm test:db`, `pnpm db:test`);
- rate limits, security headers and CSP;
- the Gmail launch gate (off by default, D-034);
- headless DOM walks of the whole journey at 1440, 1024, 390 and 320px.

**Blocked on the human. Engineering can't do these:**

1. **Supabase projects.** The organisation is on the free plan, with its two active projects (`internship-radar`, `AfterWord`) already in use. A preview and a production project need either the Pro plan or another project paused. Choose one; then section 1 can be run from the CLI.
2. **Hosting.** The repository isn't connected to Vercel (no project, no token). Create the Vercel project from the GitHub repository (or provide a `VERCEL_TOKEN`).
3. **Email.** Real sign-in email needs an SMTP provider account (for example Resend or Postmark) and a sending domain with SPF, DKIM and DMARC.
4. **Domain.** The production domain needs buying or choosing, and verifying with Vercel and the email provider.
5. **Visual review** of the states listed below.

**Not required for launch:** Google verification of `gmail.metadata` (Gmail launches switched off).

## Human visual review

Run locally with `pnpm db:start` and `pnpm dev`, then check each state:

- **Sign in:** `/sign-in` (signed out). For "link expired", `/sign-in?error=link`. For the rate-limit message, ask for six links for one address within 15 minutes, about a second apart.
- **Error page:** stop the Data API (`docker stop supabase_rest_reachout`), load `/today`, then `docker start supabase_rest_reachout` and press "Try again".
- **Onboarding:** sign in with a new address.
- **Settings:** the Account row, the read-only email, and Gmail:
  - "Coming later" with `REACHOUT_GMAIL_ENABLED` unset;
  - "Not connected", connected and "Reconnect needed" with it set to `true` (a fake Google client is enough to view these).
- **Outreach two-step:** with an approved draft, open `/outreach?person=<id>`, then press "Mark as sent", then "Yes, I sent it". No Undo follows.

Use one Supabase project (and one Google OAuth client) per environment: **preview** and **production** never share a database, users or credentials.

## 1. Supabase project

- [ ] Create the preview and production projects, in a region near your students. Set spend limits.
- [ ] Check the backups the plan includes (daily at least; point-in-time recovery if available). Do one restore drill on preview.
- [ ] Link and apply the migrations; never use the dashboard's schema editor:
      `pnpm exec supabase link --project-ref <ref>`, then `pnpm exec supabase db push`. They apply in order on a clean project:
  1. `accounts_and_workspaces`
  2. `domain_records`
  3. `workflow_functions`
  4. `mark_sent_is_final`
  5. `gmail_correspondence`
  6. `rate_limits`

  They create the `reachout_writer` role and the `private` schema. They need no extensions beyond the defaults (`gen_random_uuid` is built into Postgres), and they reference only `auth.users`, `auth.uid()` and `auth.jwt()`.

- [ ] Run the pgTAP suite against **preview**: `pnpm exec supabase test db --linked`. It runs in a rolled-back transaction. All 15 checks must pass, including:
  - RLS on every public and private table;
  - `anon` able to call only `take_rate_limit`;
  - `authenticated` able only to `SELECT` tables;
  - every write function owned by `reachout_writer`;
  - Gmail credentials unreadable through the API.
- [ ] Confirm, in the SQL editor: `select rolbypassrls, rolcanlogin from pg_roles where rolname = 'reachout_writer'` returns `false, false`.

## 2. Supabase Auth

- [ ] **Site URL:** the production origin, for example `https://app.reachout.example` (preview: its own origin).
- [ ] **Redirect URLs:** exactly `https://<origin>/auth/confirm` for each environment's own origin. No wildcards on production. If preview deployments get per-branch URLs, either allow that preview domain pattern on the **preview** project only, or use a fixed preview domain.
- [ ] **Email templates:** set Magic link and Confirm signup to the content of `supabase/templates/sign-in.html`, whose link is `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. Without this, a link opened on another device fails.
- [ ] **Providers:** email on; phone off; every OAuth provider off; anonymous sign-ins off.
- [ ] **Sign-up policy:** decide open sign-up versus invited students for the pilot. With sign-ups closed, Reachout still answers "check your email" for unknown addresses (no enumeration).
- [ ] **SMTP:** configure a real provider (sender "Reachout", SPF/DKIM/DMARC on the domain). Supabase's built-in sender is rate-limited and not for production. Send a real link and confirm it arrives and isn't marked as spam.
- [ ] **Rate limits:** review the email-sent and verification limits. Reachout requests links from its server, so Supabase sees one IP for everyone. Reachout's own per-address and per-client limits (D-032) do the per-student limiting; keep Supabase's high enough not to trip on normal use.
- [ ] **CAPTCHA (bot protection):** optional for a closed pilot; recommended before open sign-up. Turnstile or hCaptcha is configured in Auth; the sign-in form will need a small addition to pass the token.
- [ ] **Sessions:** JWT expiry 1 hour; refresh-token rotation on. Prefer asymmetric JWT signing keys, so the server verifies sessions without a round trip.

## 3. Google Cloud (Gmail)

Gmail is optional, and off for public launch (D-034). Unless `REACHOUT_GMAIL_ENABLED=true` and its four settings are all set, Settings says "Coming later" and nothing calls Google. Switch it on for preview and test users only, until Google approves the scope.

- [ ] Create a Google Cloud project per environment (or at least a separate OAuth client per environment).
- [ ] Enable the **Gmail API**.
- [ ] **OAuth consent screen:**
  - user type "External";
  - app name "Reachout", support email, the app's home page, privacy policy and terms URLs, and the authorised domain;
  - the only scope added is `https://www.googleapis.com/auth/gmail.metadata`;
  - no `openid`, `email`, `profile`, contacts, calendar or Drive.
- [ ] **Credentials:** an OAuth client ID of type **Web application**.
  - Authorised redirect URI: exactly `https://<origin>/settings/gmail/callback` (preview: its own).
  - Authorised JavaScript origins: none needed. The flow is server-side.
- [ ] **Testing mode:** while the app is in testing, add each pilot student's Google account as a test user (up to 100). In testing mode, refresh tokens expire after 7 days, so users will see "Reconnect needed" weekly. This is expected.
- [ ] **Publishing:** `gmail.metadata` is a **restricted** scope. Publishing to production needs Google's OAuth verification and an annual third-party security assessment (CASA). Budget time and cost for this before opening Gmail to everyone. It has **not** been started.
- [ ] Set the environment variables (section 4), connect a real Gmail account on preview, and verify section 5.
- [ ] **Disconnect:** Reachout revokes the grant at Google. Students can also remove Reachout at <https://myaccount.google.com/permissions>.

## 4. Deployment environment

All server-only; none are `NEXT_PUBLIC_`. Set them per environment, never in the repository.

| Variable                              | Required               | Value                                                                                                      |
| ------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                        | Yes                    | The project URL (https)                                                                                    |
| `SUPABASE_PUBLISHABLE_KEY`            | Yes                    | The project's publishable (or legacy anon) key. No service key is needed                                   |
| `REACHOUT_RATE_LIMIT_SECRET`          | Yes, in production     | 32+ random characters (`openssl rand -hex 32`)                                                             |
| `REACHOUT_GMAIL_ENABLED`              | No (launch: unset)     | Exactly `true` switches Gmail on (D-034). Leave unset in public production until Google approves the scope |
| `GOOGLE_CLIENT_ID`                    | For Gmail              | The OAuth web client's id                                                                                  |
| `GOOGLE_CLIENT_SECRET`                | For Gmail              | Its secret                                                                                                 |
| `GOOGLE_GMAIL_REDIRECT_URI`           | For Gmail              | Exactly `https://<origin>/settings/gmail/callback`                                                         |
| `GMAIL_TOKEN_ENCRYPTION_KEY`          | For Gmail              | 32 random bytes, base64 (`openssl rand -base64 32`). Back it up: losing it means reconnecting              |
| `GMAIL_TOKEN_ENCRYPTION_KEY_PREVIOUS` | Only during a rotation | The previous key, so older tokens still open                                                               |
| `REACHOUT_DEV_SEED`                   | Never                  | Development only; production refuses to serve with it set                                                  |

The demo workspace (D-035) needs no setting. It keeps each visitor's demo in the server's memory, so on several instances a demo may start afresh between requests.

- [ ] Serve over **https** on a custom domain. Cookies are `Secure`, `HttpOnly` and `SameSite=Lax` in production, and HSTS is sent.
- [ ] After deploying, check:
  - a signed-out `/today` redirects to `/sign-in?next=%2Ftoday`;
  - responses carry the CSP (with a nonce, no `unsafe-eval`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` and `Permissions-Policy`;
  - an unconfigured preview shows the error page and no data.
- [ ] `pnpm audit --prod` shows nothing new.

## 5. Live verification (not done yet)

- [ ] Sign in by email link on a phone and on a desktop, opening the link on the other device.
- [ ] Six sign-in requests for one address in a few minutes: the sixth is refused calmly.
- [ ] Complete onboarding; reload; Today shows the saved first step.
- [ ] Draft, approve, edit (approval resets), approve, then "Mark as sent" and "Yes, I sent it". Reload: the history has one sent message, and there is no Undo for it.
- [ ] **Gmail, with a real account:**
  - connect: the consent screen asks only to "view your email message metadata such as labels and headers";
  - send an approved draft from Gmail with the same subject; after "Check now", the draft is sent and the history has one message;
  - reply from the tracked person's address; it appears, and Today asks you to answer;
  - mark one sent by hand, then send it from Gmail; still one message;
  - revoke Reachout at Google; the next check says "Reconnect needed" and the rest of Reachout works;
  - disconnect: the credentials row is gone, and the history stays.
- [ ] **Two-account isolation smoke test:** account A cannot see account B's people, opportunities, drafts, history, actions, companies, facts, Gmail connection or Gmail history. Check deep links with B's ids from A's session, and direct Data API calls with A's token: reads come back empty, writes are refused (`42501`), and B's provider ids are invisible.
- [ ] Sign out; the session cookie is cleared; `/today` asks you to sign in again.

## Not built (by decision)

- Account deletion (Settings says "Not available yet").
- Changing the sign-in email (Settings shows it read-only).
- Sending email through Gmail, push notifications, and importing mail from before connecting (D-031).
- AI (phase 9).
