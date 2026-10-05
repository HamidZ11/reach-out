import { useMemo, useSyncExternalStore } from "react";

/**
 * A stand-in for `next/navigation` in component tests. Next.js keeps
 * `useSearchParams` in step with the native history methods and with Back;
 * this does the same over the jsdom URL. Use it with:
 *
 *   vi.mock("next/navigation", () => import("@/test/navigation"));
 *
 * and call `syncSearchParamsWithHistory()` once before rendering.
 */

const NAVIGATED = "test:navigated";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(NAVIGATED, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(NAVIGATED, onChange);
  };
}

export function useSearchParams() {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function usePathname() {
  return useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => "/",
  );
}

let synced = false;

/** Make pushState and replaceState announce themselves, as Next.js's router does. */
export function syncSearchParamsWithHistory() {
  if (synced) return;
  synced = true;
  for (const method of ["pushState", "replaceState"] as const) {
    const native = window.history[method].bind(window.history);
    window.history[method] = (...args: Parameters<History["pushState"]>) => {
      native(...args);
      window.dispatchEvent(new Event(NAVIGATED));
    };
  }
}

/** As if the browser had loaded or refreshed this address. */
export function visit(path: string) {
  window.history.replaceState(null, "", path);
}

/** The current address, as the tests read it. */
export function currentPath() {
  return `${window.location.pathname}${window.location.search}`;
}
