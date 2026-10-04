import type { Company } from "@/domain/company";
import type { Draft } from "@/domain/draft";
import { isPendingDraft } from "@/domain/draft";
import type { CompanyId, OpportunityId, PersonId } from "@/domain/ids";
import type { Interaction } from "@/domain/interaction";
import type { NextAction } from "@/domain/next-action";
import type { Opportunity } from "@/domain/opportunity";
import type { OutreachState } from "@/domain/outreach";
import type { Person, RelationshipStatus } from "@/domain/person";
import type { Interpretation, SourceFact, Subject } from "@/domain/research";
import { sameSubject } from "@/domain/research";
import type { CalendarDate, Instant } from "@/domain/time";
import { compareInstants } from "@/domain/time";
import type { TodayItem } from "@/domain/today";
import type { User } from "@/domain/user";
import { dayMonth, dayOf, delta, shortDay } from "@/components/dates";

/**
 * Everything the app's screens render for one user, read once through the
 * Repository on the server and handed to the client as plain records.
 */
export type Workspace = {
  now: Instant;
  today: CalendarDate;
  user: User;
  companies: Company[];
  people: Person[];
  opportunities: Opportunity[];
  interactions: Interaction[];
  drafts: Draft[];
  nextActions: NextAction[];
  facts: SourceFact[];
  interpretations: Interpretation[];
};

export type Records = Omit<Workspace, "now" | "today" | "user">;

/** The records an attention item points at, resolved for display. */
export type ItemContext = {
  item: TodayItem;
  key: string;
  person?: Person;
  company?: Company;
  opportunity?: Opportunity;
  action?: NextAction;
  draft?: Draft;
  /** Reply: the message received. Follow-up: the message being chased. */
  message?: Interaction;
  /** Signed days from today to the item's date; 0 when it has none. */
  days: number;
};

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

/** Lookups and joins for rendering. No product rules live here — those are in src/domain. */
export function indexRecords(records: Records, today: CalendarDate, timeZone: string) {
  const byId = <T extends { id: string }>(items: readonly T[]) =>
    new Map<string, T>(items.map((item) => [item.id, item]));
  const people = byId(records.people);
  const companies = byId(records.companies);
  const opportunities = byId(records.opportunities);
  const interactions = byId(records.interactions);
  const drafts = byId(records.drafts);
  const actions = byId(records.nextActions);
  const find = <T>(map: Map<string, T>, id: string | undefined) =>
    id === undefined ? undefined : map.get(id);

  const index = {
    person: (id?: PersonId) => find(people, id),
    company: (id?: CompanyId) => find(companies, id),
    opportunity: (id?: OpportunityId) => find(opportunities, id),
    companyOf: (person?: Person) => find(companies, person?.companyId),
    opportunitiesOf: (personId: PersonId) =>
      records.opportunities.filter((o) => o.personIds.includes(personId)),
    peopleOf: (opportunity: Opportunity) =>
      opportunity.personIds.map((id) => people.get(id)).filter(isDefined),
    /** Oldest first. */
    historyOf: (personId: PersonId) =>
      records.interactions
        .filter((i) => i.personId === personId)
        .toSorted((a, b) => compareInstants(a.occurredAt, b.occurredAt)),
    openActionsFor: (personId: PersonId) =>
      records.nextActions
        .filter((a) => a.status === "open" && a.personId === personId)
        .toSorted((a, b) => a.dueOn.localeCompare(b.dueOn)),
    pendingDraftsFor: (personId: PersonId) =>
      records.drafts.filter((d) => d.personId === personId && isPendingDraft(d)),
    factsAbout: (subject: Subject) => records.facts.filter((f) => sameSubject(f.subject, subject)),
    interpretationsAbout: (subject: Subject) =>
      records.interpretations.filter((i) => sameSubject(i.subject, subject)),
    daysSince: (at: Instant) => -delta(today, dayOf(at, timeZone)),

    context(item: TodayItem): ItemContext {
      switch (item.kind) {
        case "overdue_follow_up":
        case "upcoming_action": {
          const action = find(actions, item.nextActionId);
          const person = find(people, item.personId);
          const opportunity = find(opportunities, item.opportunityId);
          return {
            item,
            key: `${item.kind}:${item.nextActionId}`,
            action,
            person,
            opportunity,
            company: find(companies, person?.companyId ?? opportunity?.companyId),
            message: find(interactions, action?.interactionId),
            days: item.kind === "overdue_follow_up" ? -item.daysOverdue : item.daysUntilDue,
          };
        }
        case "reply_awaiting_response": {
          const person = find(people, item.personId);
          return {
            item,
            key: `${item.kind}:${item.interactionId}`,
            person,
            company: find(companies, person?.companyId),
            opportunity: find(opportunities, item.opportunityId),
            message: find(interactions, item.interactionId),
            days: delta(today, dayOf(item.receivedAt, timeZone)),
          };
        }
        case "deadline_approaching": {
          const opportunity = find(opportunities, item.opportunityId);
          return {
            item,
            key: `${item.kind}:${item.opportunityId}`,
            opportunity,
            company: find(companies, opportunity?.companyId),
            days: item.daysRemaining,
          };
        }
        case "draft_awaiting_approval":
        case "draft_ready_to_send": {
          const person = find(people, item.personId);
          return {
            item,
            key: `${item.kind}:${item.draftId}`,
            draft: find(drafts, item.draftId),
            person,
            company: find(companies, person?.companyId),
            opportunity: find(opportunities, item.opportunityId),
            days: 0,
          };
        }
      }
    },
  };
  return index;
}

export type RecordIndex = ReturnType<typeof indexRecords>;

/* ——— Shared wording: the labels and phrases screens compose sentences from. ——— */

/** The first word of a name; used instead of pronouns. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  return `${words[0]?.[0] ?? ""}${words.length > 1 ? (words.at(-1)?.[0] ?? "") : ""}`.toUpperCase();
}

export const RELATIONSHIP_LABEL: Record<RelationshipStatus, string> = {
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  warm: "Warm",
  dormant: "Dormant",
};

export const OUTREACH_LABEL: Record<OutreachState, string> = {
  not_started: "Not contacted",
  draft: "Draft ready",
  sent: "Awaiting reply",
  follow_up_due: "Follow-up due",
  replied: "In conversation",
  closed: "Closed",
};

export const SOURCE_LABEL: Record<Person["source"]["kind"], string> = {
  alumni_network: "Alumni network",
  event: "Event",
  linkedin: "LinkedIn",
  company_website: "Company website",
  university: "University",
  publication: "Publication",
  introduction: "Introduction",
  other: "Other",
};

export const PROVENANCE_LABEL: Record<SourceFact["provenance"]["kind"], string> = {
  public_profile: "Public profile",
  company_website: "Company website",
  university_website: "University website",
  publication: "Publication",
  event: "Event",
  correspondence: "Correspondence",
  other: "Other",
};

export const STAGE_LABEL: Record<Opportunity["status"], string> = {
  identified: "Identified",
  researching: "Researching",
  reaching_out: "Reaching out",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  closed: "Closed",
};

/** "email", "LinkedIn message", "message" */
export function channelNoun(channel: "email" | "linkedin" | "other"): string {
  return channel === "email" ? "email" : channel === "linkedin" ? "LinkedIn message" : "message";
}

/** How the user sent something: "emailed", "messaged on LinkedIn". */
export function sentVerb(interaction: Interaction | undefined): string {
  if (interaction?.kind === "message_sent" && interaction.channel === "email") return "emailed";
  if (interaction?.kind === "message_sent" && interaction.channel === "linkedin") {
    return "messaged on LinkedIn";
  }
  return "messaged";
}

export function channelOf(interaction: Interaction | undefined): string | undefined {
  if (interaction?.kind === "message_sent" || interaction?.kind === "message_received") {
    return interaction.channel === "linkedin"
      ? "LinkedIn"
      : interaction.channel === "email"
        ? "Email"
        : "Message";
  }
  if (interaction?.kind === "meeting") {
    return { in_person: "In person", video: "Video call", phone: "Phone" }[interaction.format];
  }
  return interaction?.kind === "note" ? "Note" : undefined;
}

export function listOf(words: string[], type: "conjunction" | "disjunction" = "conjunction") {
  return new Intl.ListFormat("en-GB", { style: "long", type }).format(words);
}

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

export function countWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "closes Fri 9 Oct", "closes today", or "deadline passed 22 Sept" — never a past date as if upcoming. */
export function deadlineText(
  deadline: CalendarDate | undefined,
  today: CalendarDate,
): string | undefined {
  if (!deadline) return undefined;
  if (deadline < today) return `deadline passed ${dayMonth(deadline)}`;
  if (deadline === today) return "closes today";
  return `closes ${shortDay(deadline)}`;
}

/** "Event · University of Manchester Careers Fair", "Introduction · Suggested by Daniel Mensah" */
export function sourceText(person: Person): string {
  return `${SOURCE_LABEL[person.source.kind]}${person.source.detail ? ` · ${person.source.detail}` : ""}`;
}
