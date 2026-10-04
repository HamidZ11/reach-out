import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Reachout", template: "%s · Reachout" },
  description: "Thoughtful outreach for students and recent graduates.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
