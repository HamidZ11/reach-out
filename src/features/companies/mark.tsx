import type { CSSProperties } from "react";
import k from "./companies.module.css";

/** A company's mark: its initial on a quiet tile, so companies never look like people. Decorative. */
export function Mark({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <span className={k.mark} style={{ "--size": `${size}px` } as CSSProperties} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
