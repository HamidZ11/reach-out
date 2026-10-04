import type { SurfaceId } from "./options";
import type { Snapshot } from "./snapshot";

/** What every direction's surface receives from the harness. */
export type SurfaceProps = {
  snapshot: Snapshot;
  /** Switches the harness surface, so in-app links to Today or People work. */
  navigate: (surface: SurfaceId) => void;
};
