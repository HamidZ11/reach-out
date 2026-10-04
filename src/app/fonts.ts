import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";

/**
 * The approved type pairing (DESIGN.md › Typography): Bricolage Grotesque for
 * identity — names, the thing to do, titles — and Hanken Grotesk for
 * everything operational. Exposed as CSS variables the tokens read.
 */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  variable: "--font-bricolage",
});
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });

export const fontVariables = `${bricolage.variable} ${hanken.variable}`;
