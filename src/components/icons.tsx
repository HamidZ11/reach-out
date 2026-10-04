import type { ReactNode, SVGProps } from "react";

/** Reachout's small stroke icon set. Decorative by default (aria-hidden). */

type IconProps = Omit<SVGProps<SVGSVGElement>, "stroke"> & { size?: number; weight?: number };

/** Navigation icons: outline by default, filled to mark the active state. */
type FillableProps = IconProps & { filled?: boolean };
const fillIf = (filled?: boolean) => (filled ? "currentColor" : "none");

function Icon({ size = 16, weight = 1.6, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
export const ArrowLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);
export const Check = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);
export const ChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);
export const ChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);
export const Plus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const Clock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l2.5 1.5" />
  </Icon>
);
export const Mail = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="M4 7.5l8 5.5 8-5.5" />
  </Icon>
);
export const Chat = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 5.5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7l-4.5 3.5v-3.5H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z" />
  </Icon>
);
export const Search = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5" />
  </Icon>
);
export const Pen = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 19.5h4l10-10-4-4-10 10v4z" />
    <path d="M13 7l4 4" />
  </Icon>
);
export const Send = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12L19.5 4.5l-5 15-3-6-7-1.5z" />
    <path d="M11.5 13.5l8-9" />
  </Icon>
);
export const Calendar = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="5.5" width="16" height="14" rx="2" />
    <path d="M4 10h16M9 3.5v4M15 3.5v4" />
  </Icon>
);
export const Moon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10z" />
  </Icon>
);
export const Sun = ({ filled, ...p }: FillableProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3.5" fill={fillIf(filled)} />
    <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6" />
  </Icon>
);
export const People = ({ filled, ...p }: FillableProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8.5" r="3.25" fill={fillIf(filled)} />
    <path d="M3.5 19c.5-3 2.7-4.75 5.5-4.75S14 16 14.5 19z" fill={fillIf(filled)} />
    <path d="M15.5 5.5a3.25 3.25 0 0 1 0 6M17.5 14.5c1.6.6 2.7 2.1 3 4.5" />
  </Icon>
);
export const Target = ({ filled, ...p }: FillableProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" fill={fillIf(filled)} />
    <circle cx="12" cy="12" r="0.6" fill="currentColor" />
  </Icon>
);
export const Building = ({ filled, ...p }: FillableProps) => (
  <Icon {...p}>
    <path d="M5 20V5.5a1 1 0 0 1 1-1h7.5a1 1 0 0 1 1 1V20z" fill={fillIf(filled)} />
    <path d="M14.5 10H18a1 1 0 0 1 1 1v9M3.5 20h17" />
    <path d="M8.5 8.5h2.5M8.5 12h2.5M8.5 15.5h2.5" />
  </Icon>
);
export const Sliders = ({ filled, ...p }: FillableProps) => (
  <Icon {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" fill={fillIf(filled)} />
    <circle cx="9" cy="17" r="2" fill={fillIf(filled)} />
  </Icon>
);
export const Close = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 7l10 10M17 7L7 17" />
  </Icon>
);
export const Inbox = ({ filled, ...p }: FillableProps) => (
  <Icon {...p}>
    <path d="M4 13.5l2.2-7.1A2 2 0 0 1 8.1 5h7.8a2 2 0 0 1 1.9 1.4l2.2 7.1V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18v-4.5z" />
    <path
      d="M4 13.5h4.5l1.5 2h4l1.5-2H20V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"
      fill={fillIf(filled)}
    />
  </Icon>
);
export const Menu = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);
export const Copy = (p: IconProps) => (
  <Icon {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </Icon>
);
export const Skip = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6.5l8 5.5-8 5.5v-11zM18 6.5v11" />
  </Icon>
);
export const Note = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.5 4.5h8l4 4v11h-12z" />
    <path d="M14.5 4.5v4h4M9.5 13h5M9.5 16h3" />
  </Icon>
);
export const ArrowUpRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7.5 16.5l9-9M9 7.5h7.5V15" />
  </Icon>
);
export const Compass = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.25" />
    <path d="M15 9l-1.8 4.2L9 15l1.8-4.2L15 9z" />
  </Icon>
);
/** Marks generated interpretation: a dashed outline, deliberately not a sparkle. */
export const Inferred = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="7.5" strokeDasharray="2.4 2.6" />
    <path d="M12 9v6M9 12h6" />
  </Icon>
);
