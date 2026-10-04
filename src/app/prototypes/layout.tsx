import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { fontVariables } from "./_shared/fonts";

/**
 * Design prototypes: the approved direction (C) and the surfaces in review.
 * Disposable: production routes replace them. Nothing outside imports from it.
 */
export const metadata: Metadata = {
  title: "Design exploration",
  robots: { index: false, follow: false },
};

/**
 * Phones: draw under the notch and home indicator (the shells pad themselves
 * with safe-area insets), and let the on-screen keyboard resize the layout so
 * pinned bars stay visible. Zoom stays enabled. The UI is light only, so one
 * theme colour, the canvas, matches the top of every screen.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#ecebe7",
};

export default function PrototypesLayout({ children }: { children: ReactNode }) {
  return <div className={fontVariables}>{children}</div>;
}
