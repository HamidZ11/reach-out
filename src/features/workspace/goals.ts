import type { Objective } from "@/domain/user";

/**
 * What the user can be aiming for, in words: asked first in onboarding and
 * editable in Settings (PRODUCT.md › Onboarding).
 */
export const OBJECTIVE_OPTIONS: {
  value: Objective;
  label: string;
  detail: string;
  phrase: string;
}[] = [
  {
    value: "internship",
    label: "Internship",
    detail: "A summer or placement-year role while you study",
    phrase: "an internship",
  },
  {
    value: "graduate_role",
    label: "Graduate role",
    detail: "A full-time job or graduate scheme once you finish",
    phrase: "a graduate role",
  },
  {
    value: "startup_role",
    label: "Startup role",
    detail: "Joining a small team early, often before a job is posted",
    phrase: "a role at a startup",
  },
  {
    value: "research",
    label: "Research",
    detail: "A lab placement, research assistant post or PhD route",
    phrase: "a research position",
  },
  {
    value: "mentorship",
    label: "Mentorship",
    detail: "Someone experienced to learn from",
    phrase: "a mentor",
  },
  {
    value: "other",
    label: "Something else",
    detail: "You can describe it in Settings",
    phrase: "something new",
  },
];
