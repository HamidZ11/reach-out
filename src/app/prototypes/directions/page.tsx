import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Harness } from "../_shared/harness";
import { loadSnapshot } from "../_shared/load-snapshot";
import { deviceId, directionIndex, surfaceId } from "../_shared/options";

/**
 * Design exploration over seed data read through the Repository: three
 * directions for the first surfaces, then the approved direction (C) for the
 * rest, on desktop or in a phone frame. Development only — production serves 404.
 */
export default async function DirectionsPage({
  searchParams,
}: PageProps<"/prototypes/directions">) {
  if (process.env.NODE_ENV === "production") notFound();
  await connection();
  const [snapshot, params] = await Promise.all([loadSnapshot(), searchParams]);
  return (
    <Harness
      snapshot={snapshot}
      initialDirection={directionIndex(params.v)}
      initialSurface={surfaceId(params.s)}
      initialDevice={deviceId(params.d, params.s)}
    />
  );
}
