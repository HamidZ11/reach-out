export const DIRECTIONS = [
  { id: "briefing", label: "A · Briefing" },
  { id: "triage", label: "B · Triage" },
  { id: "focus", label: "C · Focus" },
] as const;

export const SURFACES = [
  { id: "today", label: "Today" },
  { id: "people", label: "People" },
  { id: "opportunities", label: "Opportunities" },
  { id: "outreach", label: "Outreach" },
  { id: "companies", label: "Companies" },
  { id: "settings", label: "Settings" },
  { id: "onboarding", label: "Onboarding" },
] as const;

export type SurfaceId = (typeof SURFACES)[number]["id"];

export const DEVICES = [
  { id: "desktop", label: "Desktop" },
  { id: "phone", label: "Phone" },
] as const;

export type DeviceId = (typeof DEVICES)[number]["id"];

type Param = string | string[] | undefined;

const first = (value: Param) => (Array.isArray(value) ? value[0] : value);

/** Earlier links named the phone views as surfaces of their own. */
const LEGACY_PHONE: Record<string, SurfaceId> = { mobile: "today", onboardingMobile: "onboarding" };

/** `?v=2` → index 1; anything else → the first direction. */
export function directionIndex(value: Param): number {
  const n = Number.parseInt(first(value) ?? "", 10);
  return n >= 1 && n <= DIRECTIONS.length ? n - 1 : 0;
}

export function surfaceId(value: Param): SurfaceId {
  const id = first(value) ?? "";
  return LEGACY_PHONE[id] ?? SURFACES.find((s) => s.id === id)?.id ?? "today";
}

/** `?d=phone`, or a legacy phone surface such as `?s=mobile`. */
export function deviceId(device: Param, surface: Param): DeviceId {
  return first(device) === "phone" || (first(surface) ?? "") in LEGACY_PHONE ? "phone" : "desktop";
}
