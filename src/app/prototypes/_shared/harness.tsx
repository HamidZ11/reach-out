"use client";

import "./picker.css";
import type { ComponentType } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as Briefing from "../_briefing/briefing";
import * as Focus from "../_focus/focus";
import * as Triage from "../_triage/triage";
import styles from "./harness.module.css";
import type { DeviceId, SurfaceId } from "./options";
import { DEVICES, DIRECTIONS, SURFACES } from "./options";
import type { Snapshot } from "./snapshot";
import type { SurfaceProps } from "./surface";

type Surface = ComponentType<SurfaceProps>;

/**
 * Every direction has the four surfaces of the first round. Everything after
 * them was designed for the approved direction (C) only.
 */
type Direction = {
  Today: Surface;
  People: Surface;
  Onboarding: Surface;
  TodayMobile: Surface;
  OnboardingMobile?: Surface;
  PeopleMobile?: Surface;
  Opportunities?: Surface;
  OpportunitiesMobile?: Surface;
  Outreach?: Surface;
  OutreachMobile?: Surface;
  Companies?: Surface;
  CompaniesMobile?: Surface;
  Settings?: Surface;
  SettingsMobile?: Surface;
};

const MODULES: readonly Direction[] = [Briefing, Triage, Focus];

const VIEWS: Record<SurfaceId, Record<DeviceId, keyof Direction | undefined>> = {
  today: { desktop: "Today", phone: "TodayMobile" },
  people: { desktop: "People", phone: "PeopleMobile" },
  opportunities: { desktop: "Opportunities", phone: "OpportunitiesMobile" },
  outreach: { desktop: "Outreach", phone: "OutreachMobile" },
  companies: { desktop: "Companies", phone: "CompaniesMobile" },
  settings: { desktop: "Settings", phone: "SettingsMobile" },
  onboarding: { desktop: "Onboarding", phone: "OnboardingMobile" },
};

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);

/**
 * Exploration harness: one direction at a time, full size, switched instantly.
 * The picker follows the prototype skill's PICKER.md behaviour contract.
 */
export function Harness({
  snapshot,
  initialDirection,
  initialSurface,
  initialDevice,
}: {
  snapshot: Snapshot;
  initialDirection: number;
  initialSurface: SurfaceId;
  initialDevice: DeviceId;
}) {
  const [direction, setDirection] = useState(initialDirection);
  const [surface, setSurface] = useState<SurfaceId>(initialSurface);
  const [device, setDevice] = useState<DeviceId>(initialDevice);
  const pickerRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = DIRECTIONS.length;

  // Persist the selection in the URL (?v=3&s=people&d=phone).
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(direction + 1));
    url.searchParams.set("s", surface);
    if (device === "phone") url.searchParams.set("d", "phone");
    else url.searchParams.delete("d");
    window.history.replaceState(null, "", url);
  }, [direction, surface, device]);

  // Slide the highlight to the active item; measured from layout.
  useLayoutEffect(() => {
    const move = () => {
      const item = itemRefs.current[direction];
      const highlight = highlightRef.current;
      if (!item || !highlight) return;
      highlight.style.width = `${item.offsetWidth}px`;
      highlight.style.transform = `translateX(${item.offsetLeft}px)`;
    };
    move();
    window.addEventListener("resize", move);
    return () => window.removeEventListener("resize", move);
  }, [direction]);

  // Enable the slide only after first paint, so load doesn't animate.
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => pickerRef.current?.setAttribute("data-ready", "")),
    );
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const n = Number.parseInt(event.key, 10);
      if (n >= 1 && n <= count) setDirection(n - 1);
      else if (event.key === "ArrowRight") setDirection((d) => (d + 1) % count);
      else if (event.key === "ArrowLeft") setDirection((d) => (d - 1 + count) % count);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [count]);

  const active: Direction = MODULES[direction] ?? Briefing;
  const name = VIEWS[surface][device];
  const View = name ? active[name] : undefined;
  const key = `${direction}:${surface}:${device}`;
  const label = SURFACES.find((s) => s.id === surface)?.label ?? surface;
  const missing =
    device === "phone" && !VIEWS[surface].phone
      ? `${label} on a phone hasn't been designed yet.`
      : `${label}${device === "phone" ? " on a phone" : ""} was designed for C only, after A and B were set aside.`;

  return (
    <>
      <header className={styles.bar}>
        <span className={styles.title}>Reachout — design exploration</span>
        <nav className={styles.tabs} aria-label="Surfaces">
          {SURFACES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={styles.tab}
              aria-current={s.id === surface ? "page" : undefined}
              onClick={() => setSurface(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className={styles.devices} role="group" aria-label="Device">
          {DEVICES.map((d) => (
            <button
              key={d.id}
              type="button"
              className={styles.tab}
              aria-pressed={d.id === device}
              onClick={() => setDevice(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <span className={styles.note}>Prototype · seed data · nothing is saved</span>
      </header>

      <div className={styles.stage}>
        {device === "phone" ? (
          <div className={styles.phoneStage}>
            {View ? (
              <div className={styles.phone}>
                <View key={key} snapshot={snapshot} navigate={setSurface} />
              </div>
            ) : (
              <p className={styles.missing}>{missing}</p>
            )}
          </div>
        ) : View ? (
          <View key={key} snapshot={snapshot} navigate={setSurface} />
        ) : (
          <div className={styles.phoneStage}>
            <p className={styles.missing}>{missing}</p>
          </div>
        )}
      </div>

      <nav ref={pickerRef} className="proto-picker" aria-label="Prototype variants">
        <span ref={highlightRef} className="proto-picker-highlight" aria-hidden="true" />
        {DIRECTIONS.map((d, i) => (
          <button
            key={d.id}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            type="button"
            className="proto-picker-item"
            data-active={i === direction ? "" : undefined}
            aria-current={i === direction ? "true" : undefined}
            onClick={() => setDirection(i)}
          >
            {d.label}
          </button>
        ))}
      </nav>
    </>
  );
}
