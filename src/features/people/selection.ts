import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { PersonId } from "@/domain/ids";
import { PersonIdSchema } from "@/domain/ids";
import type { Person } from "@/domain/person";
import { PERSON_PARAM, personHref, SECTIONS } from "@/features/sections";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import { mostRecentlyActive } from "./groups";

/**
 * Which person People shows lives in the URL (`/people?person=<id>`), so a
 * refresh keeps it, Today can link straight to someone, and the browser's Back
 * works. Both layouts read the same id. The native history methods keep
 * `useSearchParams` in step without a server round trip.
 */

/** The person a URL names, if the id is well formed and is one of the user's people. */
export function personInParams(
  params: Pick<URLSearchParams, "get">,
  day: Pick<WorkspaceState, "index">,
): Person | undefined {
  const parsed = PersonIdSchema.safeParse(params.get(PERSON_PARAM));
  return parsed.success ? day.index.person(parsed.data) : undefined;
}

export function usePersonInUrl(day: WorkspaceState) {
  const params = useSearchParams();
  const requested = personInParams(params, day);
  // Without a valid id, desktop opens on the most recent conversation.
  const [fallback] = useState(() => mostRecentlyActive(day) ?? day.records.people[0]?.id);
  // Whether this page pushed the open person, so its own Back can simply go back.
  const [pushed, setPushed] = useState(false);

  return {
    /** The person the URL names; on a phone, the open page. Unknown ids name no one. */
    requested,
    /** Desktop always shows someone: the URL's person, or the fallback. */
    selectedId: requested?.id ?? fallback,
    /** Whether the open person was opened from the list on this page. */
    openedHere: pushed,
    /** Desktop: selecting replaces the entry, so Back leaves People instead of replaying clicks. */
    select(id: PersonId) {
      window.history.replaceState(null, "", personHref(id));
    },
    /** Phone: a person is a page of its own, so the browser's Back returns to the list. */
    open(id: PersonId) {
      setPushed(true);
      window.history.pushState(null, "", personHref(id));
    },
    /** Back to the list. Arrived some other way (a link from Today, a refresh)? Replace it. */
    close() {
      setPushed(false);
      if (pushed) window.history.back();
      else window.history.replaceState(null, "", SECTIONS.people.href);
    },
  };
}

export type PersonSelection = ReturnType<typeof usePersonInUrl>;
