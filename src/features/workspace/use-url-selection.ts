import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Which record a list-and-detail screen shows lives in the URL
 * (`?<param>=<id>`), so a refresh keeps it, other screens can link straight to
 * it, and the browser's Back works. Ids are validated with Zod; an unknown id
 * names nothing, and the screen falls back. The native history methods keep
 * `useSearchParams` in step without a server round trip.
 *
 * Desktop selects (replacing the history entry, so Back leaves the screen
 * instead of replaying clicks). A phone opens a record as a page of its own
 * (pushing an entry, so Back returns to the list).
 */
export function useUrlSelection<Id extends string, Item extends { id: Id }>({
  param,
  schema,
  find,
  href,
  listHref,
  fallback,
}: {
  param: string;
  /** The id's Zod schema (a branded id schema from `@/domain/ids`). */
  schema: { safeParse(value: unknown): { success: true; data: Id } | { success: false } };
  find: (id: Id) => Item | undefined;
  href: (id: Id) => Route;
  listHref: Route;
  /** Desktop always shows something: what to show when the URL names nothing valid. */
  fallback: () => Id | undefined;
}) {
  const params = useSearchParams();
  const parsed = schema.safeParse(params.get(param));
  const requested = parsed.success ? find(parsed.data) : undefined;
  const [fallbackId] = useState(fallback);
  // Whether this page pushed the open record, so its own Back can simply go back.
  const [pushed, setPushed] = useState(false);

  return {
    /** The record the URL names; on a phone, the open page. Unknown ids name nothing. */
    requested,
    /** Desktop always shows something: the URL's record, or the fallback. */
    selectedId: requested?.id ?? fallbackId,
    /** Whether the open record was opened from the list on this page. */
    openedHere: pushed,
    select(id: Id) {
      window.history.replaceState(null, "", href(id));
    },
    open(id: Id) {
      setPushed(true);
      window.history.pushState(null, "", href(id));
    },
    /** Back to the list. Arrived some other way (a link, a refresh)? Replace it. */
    close() {
      setPushed(false);
      if (pushed) window.history.back();
      else window.history.replaceState(null, "", listHref);
    },
  };
}
