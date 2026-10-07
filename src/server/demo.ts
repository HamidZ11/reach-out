import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Repository } from "@/data/repository";
import { SEED_TIME_ZONE, SEED_USER_ID } from "@/data/seed/dataset";
import { createDemoDataset } from "@/data/seed/demo-dataset";
import { createSeedRepository } from "@/data/seed/seed-repository";
import type { UserId } from "@/domain/ids";
import type { CalendarDate } from "@/domain/time";
import { calendarDateIn } from "@/domain/time";
import { DEMO_COOKIE, DEMO_COOKIE_OPTIONS, looksLikeDemo } from "./demo-cookie";

/**
 * The demo workspace (D-035): anyone can look around Reachout without an
 * account. "Try the demo" gives the browser a demo id the server signed; each
 * demo id gets its own copy of the demo dataset (the seed's fictional
 * student, `createDemoDataset`), held in this server's memory and nowhere else.
 *
 * - It never reaches Supabase: no auth call, no database, no real account.
 * - The id only chooses which copy of the fictional records to use. It is
 *   never a user or workspace id; the user is always the dataset's own.
 * - The signing key is made when the server starts and never leaves it, so
 *   a cookie is good only for the server that issued it, until it restarts.
 *   That is also how long the records last.
 * - Changes last for the visit. Reset starts again; leaving forgets them.
 */

/** A demo untouched this long is forgotten (the next visit starts afresh). */
const IDLE_MS = 2 * 60 * 60 * 1000;
/** Demos kept at once; past this, the least recently used is forgotten. */
const MAX_DEMOS = 200;

type Demo = { anchor: CalendarDate; repository: Repository; usedAt: number };
type DemoState = { key: Buffer; demos: Map<string, Demo> };

const STATE = Symbol.for("reachout.demo");

function state(): DemoState {
  const holder = globalThis as typeof globalThis & { [STATE]?: DemoState };
  holder[STATE] ??= { key: randomBytes(32), demos: new Map() };
  return holder[STATE];
}

function signature(id: string): string {
  return createHmac("sha256", state().key).update(`reachout:demo:v1:${id}`).digest("base64url");
}

/** The cookie value for a demo id. */
export function demoToken(id: string): string {
  return `${id}.${signature(id)}`;
}

/** The demo id in a cookie value, only if this server issued it; anything else is no demo. */
export function verifyDemoToken(value: string | undefined): string | null {
  if (!looksLikeDemo(value)) return null;
  const [id = "", given = ""] = value!.split(".");
  const expected = Buffer.from(signature(id));
  const actual = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? id : null;
}

/** The demo this browser is in, or null. */
export async function currentDemo(): Promise<string | null> {
  return verifyDemoToken((await cookies()).get(DEMO_COOKIE)?.value);
}

/** Enters the demo. A browser already in one carries on where it was. */
export async function startDemo(): Promise<void> {
  const store = await cookies();
  if (verifyDemoToken(store.get(DEMO_COOKIE)?.value)) return;
  store.set(DEMO_COOKIE, demoToken(randomBytes(16).toString("hex")), DEMO_COOKIE_OPTIONS);
}

/** Leaves the demo: its records are forgotten and the cookie cleared. */
export async function endDemo(): Promise<void> {
  const store = await cookies();
  const id = verifyDemoToken(store.get(DEMO_COOKIE)?.value);
  if (id) state().demos.delete(id);
  if (store.get(DEMO_COOKIE)) store.set(DEMO_COOKIE, "", { ...DEMO_COOKIE_OPTIONS, maxAge: 0 });
}

/** Starts this demo again from the demo dataset. */
export function resetDemo(id: string): void {
  state().demos.delete(id);
}

/** Whose records the demo shows: the seed dataset's student, whatever the demo id. */
export const DEMO_USER_ID: UserId = SEED_USER_ID;

/**
 * This demo's records, in memory. A new demo, or one forgotten (idle, evicted,
 * or a new day, so dates stay relative), starts from the demo dataset.
 */
export function demoRepository(id: string, now = new Date()): Repository {
  const { demos } = state();
  const clock = now.getTime();
  // Oldest first: the map is kept in order of use.
  for (const [key, demo] of demos) {
    if (clock - demo.usedAt <= IDLE_MS) break;
    demos.delete(key);
  }

  const anchor = calendarDateIn(now, SEED_TIME_ZONE);
  const existing = demos.get(id);
  demos.delete(id);
  const demo =
    existing?.anchor === anchor
      ? { ...existing, usedAt: clock }
      : { anchor, repository: fresh(anchor), usedAt: clock };
  demos.set(id, demo);
  while (demos.size > MAX_DEMOS) {
    const oldest = demos.keys().next().value;
    if (oldest === undefined) break;
    demos.delete(oldest);
  }
  return demo.repository;
}

function fresh(anchor: CalendarDate): Repository {
  return createSeedRepository(createDemoDataset(anchor), DEMO_USER_ID);
}
