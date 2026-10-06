import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SignIn } from "@/features/sign-in/sign-in";
import { requestSignInLink } from "@/app/auth/actions";
import { getSession } from "@/server/auth";
import { authMode } from "@/server/config";
import { safeNextPath } from "@/server/next-path";

export const metadata: Metadata = { title: "Sign in" };

/**
 * Public. Already signed in (or in the development seed session, which has no
 * sign-in)? Straight on. Unconfigured, `authMode` throws: it fails closed.
 */
export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  await connection();
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (authMode().kind !== "supabase" || (await getSession())) redirect(next as Route);
  return <SignIn next={next} linkFailed={params.error === "link"} request={requestSignInLink} />;
}
