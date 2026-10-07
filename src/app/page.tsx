import type { Metadata } from "next";
import { connection } from "next/server";
import { Landing } from "@/features/landing/landing";
import { enterDemo } from "./demo/actions";

export const metadata: Metadata = {
  title: { absolute: "Reachout" },
  description:
    "A personal outreach workspace for students and new grads: the people, opportunities and conversations behind a job search.",
};

/**
 * The public landing page. It reads no session and no records, so anyone can
 * open it, signed in or not. "Try the demo" enters the demo workspace
 * (D-035); "Sign in" is the real sign-in.
 */
export default async function LandingPage() {
  await connection(); // per request, so this request's CSP nonce reaches the page's scripts (D-033)
  return <Landing enterDemo={enterDemo} />;
}
