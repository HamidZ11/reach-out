import Link from "next/link";
import o from "@/features/onboarding/onboarding.module.css";
import t from "@/features/today/today.module.css";
import { DemoButton } from "./demo-button";
import l from "./landing.module.css";

/**
 * The public landing page: what Reachout is, how outreach works in it, and
 * two ways in (the demo, or signing in). Built from the approved system: the
 * mark, the black primary action, white sheets and hairline rows. No numbers,
 * logos or quotes: there are none to show.
 */

const FLOW: { name: string; text: string; yours?: boolean }[] = [
  { name: "Find", text: "the people and opportunities worth your time" },
  { name: "Research", text: "what they work on, and what's public about it" },
  { name: "Understand", text: "why this person matters to what you want" },
  { name: "Draft", text: "a message in your own words" },
  { name: "Approve", text: "nothing is ready to send until you say so", yours: true },
  { name: "Send", text: "yourself, from your own email or LinkedIn", yours: true },
  { name: "Follow up", text: "when Today says it's time" },
];

const POINTS: { title: string; lead: string; text: string }[] = [
  {
    title: "Know who matters",
    lead: "Keep people, opportunities and companies connected.",
    text: "A recruiter, an engineer who replied, a lecturer who runs a research placement: each one sits with the opportunity they relate to, alongside why they matter to you.",
  },
  {
    title: "Know what to do next",
    lead: "Today surfaces the next useful action instead of making you manage a CRM.",
    text: "An overdue follow-up, a reply waiting for an answer, a deadline this week, a draft to approve: Today puts them in order and leaves the rest alone.",
  },
  {
    title: "Keep the relationship history",
    lead: "See what you sent, what they replied, and where the opportunity stands.",
    text: "Every message you send and every reply joins that person's history, so the next conversation starts where the last one ended.",
  },
];

function TryTheDemo({ enterDemo }: { enterDemo: () => Promise<void> }) {
  return (
    <form action={enterDemo} className={l.form}>
      <DemoButton />
    </form>
  );
}

export function Landing({
  enterDemo,
}: {
  /** Enters the demo workspace (a Server Action in production). */
  enterDemo: () => Promise<void>;
}) {
  return (
    <div className={l.page}>
      <header className={l.top}>
        <span className={o.brand}>
          <span className={o.mark} aria-hidden="true">
            r
          </span>
          Reachout
        </span>
        <Link href="/sign-in" className={`${t.text} ${t.small}`}>
          Sign in
        </Link>
      </header>

      <main id="main">
        <section className={l.hero} aria-labelledby="landing-title">
          <div className={l.heroText}>
            <h1 id="landing-title" className={l.title}>
              A personal outreach workspace for students and new grads.
            </h1>
            <p className={l.lead}>
              Track the people, opportunities and conversations behind your job search.
            </p>
            <div className={l.actions}>
              <TryTheDemo enterDemo={enterDemo} />
              <Link href="/sign-in" className={t.secondary}>
                Sign in
              </Link>
            </div>
            <p className={l.note}>
              The demo opens a fictional student&apos;s workspace. No account or email needed.
            </p>
          </div>

          <div className={l.flow} aria-labelledby="landing-flow">
            <h2 id="landing-flow" className={l.flowTitle}>
              How it works
            </h2>
            <ol className={l.steps}>
              {FLOW.map((step, index) => (
                <li key={step.name} className={l.step} data-yours={step.yours || undefined}>
                  <span className={l.stepNumber} aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className={l.stepName}>{step.name}</span>
                  <span className={l.stepText}>{step.text}</span>
                </li>
              ))}
            </ol>
            <p className={l.flowNote}>
              <span className={l.flowDot} aria-hidden="true" />
              You approve every message and send it yourself. Reachout never sends anything.
            </p>
          </div>
        </section>

        <section className={l.points} aria-label="What Reachout does">
          {POINTS.map((point) => (
            <div key={point.title} className={l.point}>
              <h2 className={l.pointTitle}>{point.title}</h2>
              <div className={l.pointBody}>
                <p className={l.pointLead}>{point.lead}</p>
                <p className={l.pointText}>{point.text}</p>
              </div>
            </div>
          ))}
        </section>

        <section className={l.closing} aria-labelledby="landing-closing">
          <div className={l.closingText}>
            <h2 id="landing-closing" className={l.closingTitle}>
              Look around a job search in progress.
            </h2>
            <p className={l.closingLead}>
              People, opportunities and drafts are already there. Change anything: it lasts for your
              visit, and nothing is ever sent.
            </p>
          </div>
          <TryTheDemo enterDemo={enterDemo} />
        </section>
      </main>

      <footer className={l.foot}>
        Reachout · Thoughtful outreach for students and recent graduates.
      </footer>
    </div>
  );
}
