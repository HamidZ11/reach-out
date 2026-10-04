import {
  Bricolage_Grotesque,
  Hanken_Grotesk,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Newsreader,
  Public_Sans,
} from "next/font/google";

/**
 * Exploration-only typefaces, one family set per direction. Scoped to the
 * prototypes route through CSS variables; nothing in production loads them.
 */

// A · Briefing: a reading serif with optical sizes, plus a plain sans for labels.
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
});
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans" });

// B · Triage: an engineered sans and its mono for dates, counts and times.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

// C · Focus refinement: a characterful display for names and the one thing that
// matters, over a calm grotesk for everything operational.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  variable: "--font-bricolage",
});
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });

export const fontVariables = [newsreader, publicSans, plexSans, plexMono, bricolage, hanken]
  .map((font) => font.variable)
  .join(" ");
