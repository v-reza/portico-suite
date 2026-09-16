/**
 * Inline icon set for the suite chrome.
 *
 * Why inline SVG and not Material Symbols: the Stitch HTML loads the Material
 * Symbols web font from Google Fonts and writes ligature names as text
 * (`<span>domain</span>`). If that font fails to load — offline, blocked CDN,
 * slow first paint — the browser renders the raw ligature words, and a 56px
 * rail clips them into "doma" / "supp". Inline paths cannot fail that way and
 * cost nothing extra at runtime.
 *
 * All icons share a 24x24 viewBox and use currentColor.
 */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Portico Hub — the control-plane mark. */
export function IconHub(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="5" r="2.25" />
      <circle cx="5" cy="18" r="2.25" />
      <circle cx="19" cy="18" r="2.25" />
      <path d="M12 7.25v3.5M10.2 12.1 6.6 15.9M13.8 12.1l3.6 3.8" />
    </Icon>
  );
}

/** Platform — stacked layers. */
export function IconLayers(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 3.5 8l8.5 4.5L20.5 8 12 3.5Z" />
      <path d="M3.5 12.5 12 17l8.5-4.5" />
      <path d="M3.5 16.5 12 21l8.5-4.5" />
    </Icon>
  );
}

/** Helpdesk — support agent. */
export function IconSupport(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 13v-1a7.5 7.5 0 0 1 15 0v1" />
      <path d="M4.5 13h2.2a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H5.6a1.1 1.1 0 0 1-1.1-1.1V13Z" />
      <path d="M19.5 13h-2.2a1 1 0 0 0-1 1v3.5a1 1 0 0 0 1 1h1.1a1.1 1.1 0 0 0 1.1-1.1V13Z" />
      <path d="M17 20a3 3 0 0 1-3 2h-1.5" />
    </Icon>
  );
}

/** Code Review — terminal / diff. */
export function IconTerminal(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M7.5 9.5 10 12l-2.5 2.5" />
      <path d="M12.5 15h4" />
    </Icon>
  );
}

/** Settings — gear. Teeth are drawn as a closed ring so it reads as a gear,
 *  not a sun (radial spokes read as rays). */
export function IconSettings(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.1 4.7a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03Z" />
    </Icon>
  );
}

/** Trash / delete. */
export function IconTrash(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </Icon>
  );
}

/** Plus — used by create/add buttons. */
export function IconPlus(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

/** Chevron right — used by list rows. */
export function IconChevronRight(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.25 4.5 15.75 12l-7.5 7.5" />
    </Icon>
  );
}

/** Sparkles — AI features. */
export function IconSparkles(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3l1.8 4.6L18.5 9.5l-4.7 1.9L12 16l-1.8-4.6L5.5 9.5l4.7-1.9L12 3Z" />
      <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" />
      <path d="M5 15l.7 1.6L7.5 17.3l-1.8.7L5 19.5l-.7-1.5L2.5 17.3l1.8-.7L5 15Z" />
    </Icon>
  );
}

/** Grid / dashboard — sidebar "Apps". */
export function IconGrid(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </Icon>
  );
}

/** Extension / puzzle — sidebar "Komponen". */
export function IconExtension(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13.5 4.5A2.5 2.5 0 0 0 11 7v1.2H5a1.5 1.5 0 0 0-1.5 1.5v3A1.5 1.5 0 0 0 5 14.2h1.2V20a1.5 1.5 0 0 0 1.5 1.5h2.8A2.5 2.5 0 0 0 13 19h.5a2 2 0 0 0 2-2v-.8h3.5a2 2 0 0 0 2-2v-2.5a2 2 0 0 0-2-2H15.5A2 2 0 0 0 13.5 7V4.5Z" />
      <path d="M13.5 4.5V7" />
    </Icon>
  );
}

/** Plug / cable — sidebar "Integrasi". */
export function IconCable(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 14.5 3.5 18a2 2 0 0 0 2.8 2.8l3.5-3.5" />
      <path d="M17 9.5 20.5 6a2 2 0 0 0-2.8-2.8L14.2 6.7" />
      <path d="M12.5 6 18 11.5 11.5 18 6 12.5 12.5 6Z" />
      <path d="M6.2 12.5 11.5 6M17.8 11.5 12.5 17.8" />
    </Icon>
  );
}

/** Workflow / account_tree — sidebar "Alur Kerja". */
export function IconWorkflow(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="5" cy="5" r="2.2" />
      <circle cx="19" cy="5" r="2.2" />
      <circle cx="5" cy="19" r="2.2" />
      <circle cx="19" cy="19" r="2.2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M7.2 5.8h9.6M12 10v2M16.8 5.8v9.6M7.2 5.8v9.6" />
    </Icon>
  );
}

/** Play / chevron — sidebar "Eksekusi". */
export function IconPlay(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 5.5 18.5 12 8 18.5V5.5Z" />
    </Icon>
  );
}

/** Sliders / tune — sidebar "Model & LLM". */
export function IconTune(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 7.5h14M5 12h14M5 16.5h14" />
      <circle cx="9" cy="7.5" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="9" cy="16.5" r="2" />
    </Icon>
  );
}

/** Key — sidebar "Kunci API". */
export function IconKey(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="15" r="4.2" />
      <path d="m11.2 11.8 7.3-7.3M16 7l2.4 2.4M13.5 9.5 16 12" />
    </Icon>
  );
}

/** Close — the dialog dismiss glyph. */
export function IconX(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Icon>
  );
}

/** Person + plus — "Undang anggota". */
export function IconPersonAdd(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="8" r="3.6" />
      <path d="M4 19.5c0-3.1 2.7-5.2 6-5.2s6 2.1 6 5.2" />
      <path d="M18.5 7v5M16 9.5h5" />
    </Icon>
  );
}

/** Vertical ellipsis — per-row action menu. */
export function IconMoreVertical(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** Check in a circle — success banner. */
export function IconCheckCircle(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </Icon>
  );
}

