import type { Opportunity } from "@/domain/opportunity";
import { OPPORTUNITY_STATUSES } from "@/domain/opportunity";
import { STAGE_LABEL } from "@/features/workspace/records";
import k from "./pursuing.module.css";
import { CLOSED_LABEL, STAGE_PHRASE } from "./wording";

/** The domain's stages before closing, in order (DOMAIN.md › Opportunity). */
const STEPS = OPPORTUNITY_STATUSES.filter((st) => st !== "closed");

/**
 * Where you are: a sentence, then the domain's stages as a quiet path drawn
 * like the history — a hairline with small nodes, one brand marker for now.
 * Never a funnel, a progress bar or step cards. On a phone (`compact`) the
 * stage names are left to the sentence and screen readers.
 */
export function StageTrack({ o, compact = false }: { o: Opportunity; compact?: boolean }) {
  const at = STEPS.indexOf(o.status as (typeof STEPS)[number]);
  const closed = o.status === "closed";
  const label = closed
    ? `Closed${o.closedReason ? ` · ${CLOSED_LABEL[o.closedReason]}` : ""}`
    : `${STAGE_LABEL[o.status]} · step ${at + 1} of ${STEPS.length}`;
  const phrase =
    closed && o.closedReason
      ? `Closed — ${CLOSED_LABEL[o.closedReason].toLowerCase()}`
      : STAGE_PHRASE[o.status];
  return (
    <div
      className={compact ? `${k.stages} ${k.compact}` : k.stages}
      data-closed={closed || undefined}
    >
      <p className={k.stageNow} aria-hidden="true">
        <span className={k.stageWord}>{phrase}</span>
        {!closed && (
          <span className={k.stageCount}>
            {at + 1} of {STEPS.length}
          </span>
        )}
      </p>
      <ol className={k.stageTrack} aria-label={`Stage: ${label}`}>
        {STEPS.map((st, i) => (
          <li
            key={st}
            className={k.stage}
            data-state={closed ? undefined : i < at ? "done" : i === at ? "current" : undefined}
            aria-current={!closed && i === at ? "step" : undefined}
          >
            <span className={k.stageNode} aria-hidden="true" />
            <span className={k.stageName}>{STAGE_LABEL[st]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
