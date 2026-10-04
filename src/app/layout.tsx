import type { Metadata, Viewport } from "next";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Reachout", template: "%s · Reachout" },
  description: "Thoughtful outreach for students and recent graduates.",
};

/**
 * Phones: draw under the notch and home indicator (the shell pads itself with
 * safe-area insets) and let the on-screen keyboard resize the layout. Zoom
 * stays enabled. The UI is light only, so one theme colour — the canvas —
 * matches the top of every screen.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#ecebe7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
