import type { CSSProperties } from "react";
import s from "./avatar.module.css";

const TINTS: [string, string][] = [
  ["#e6ecf3", "#2b4a6b"],
  ["#efe7dc", "#6b4a23"],
  ["#e4efe9", "#245a43"],
  ["#f1e4e1", "#7a3626"],
  ["#e9e6f1", "#463e6e"],
  ["#ece9df", "#55502f"],
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  return `${words[0]?.[0] ?? ""}${words.length > 1 ? (words.at(-1)?.[0] ?? "") : ""}`.toUpperCase();
}

/** A muted tint chosen from the name, so a person always looks the same. Decorative. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const [bg, ink] = TINTS[hash % TINTS.length] ?? ["#eee", "#222"];
  const style = { "--size": `${size}px`, "--tint-bg": bg, "--tint-ink": ink } as CSSProperties;
  return (
    <span className={s.avatar} style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
