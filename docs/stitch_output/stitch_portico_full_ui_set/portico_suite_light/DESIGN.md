---
name: Portico Suite Light
colors:
  surface: '#f9f9fa'
  surface-dim: '#dadadb'
  surface-bright: '#f9f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeef'
  surface-container-high: '#e8e8e9'
  surface-container-highest: '#e2e2e3'
  on-surface: '#1a1c1d'
  on-surface-variant: '#47464b'
  inverse-surface: '#2f3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#78767b'
  outline-variant: '#c8c5cb'
  surface-tint: '#5f5e63'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1f'
  on-primary-container: '#858388'
  inverse-primary: '#c8c5cb'
  secondary: '#5a5f67'
  on-secondary: '#ffffff'
  secondary-container: '#dee2ec'
  on-secondary-container: '#60656d'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#171c23'
  on-tertiary-container: '#7f848c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e4e1e7'
  primary-fixed-dim: '#c8c5cb'
  on-primary-fixed: '#1b1b1f'
  on-primary-fixed-variant: '#47464b'
  secondary-fixed: '#dee2ec'
  secondary-fixed-dim: '#c2c7d0'
  on-secondary-fixed: '#171c23'
  on-secondary-fixed-variant: '#42474f'
  tertiary-fixed: '#dee3ec'
  tertiary-fixed-dim: '#c2c7d0'
  on-tertiary-fixed: '#171c23'
  on-tertiary-fixed-variant: '#42474f'
  background: '#f9f9fa'
  on-background: '#1a1c1d'
  surface-variant: '#e2e2e3'
  accent: '#6e5ae6'
  accent-hover: '#5b46d6'
  info: '#6e5ae6'
  success: '#16a34a'
  warning: '#d97706'
  danger: '#dc2626'
  danger-solid: '#dc2626'
  surface-page: '#f7f7f8'
  surface-panel: '#ffffff'
  surface-elevated: '#ffffff'
  surface-hover: '#f1f1f3'
  surface-sunken: '#ededf0'
  surface-canvas: '#f1f1f4'
  surface-accent-tint: '#f2f0fe'
  border-subtle: rgba(15,23,42,0.06)
  border-standard: rgba(15,23,42,0.10)
  text-primary: '#101014'
  text-secondary: '#4b5058'
  text-tertiary: '#62676f'
  text-quaternary: '#9aa0aa'
  overlay: rgba(16,16,20,0.40)
  critical: '#b91c1c'
  diff-added-bg: rgba(22,163,74,0.10)
  diff-added-gutter: rgba(22,163,74,0.22)
  diff-removed-bg: rgba(220,38,38,0.08)
  diff-removed-gutter: rgba(220,38,38,0.22)
  diff-context-bg: '#fbfbfc'
typography:
  display-xl:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: '590'
    lineHeight: '1.13'
    letterSpacing: -0.704px
  heading-section:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '590'
    lineHeight: '1.33'
    letterSpacing: -0.24px
  heading-card:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '560'
    lineHeight: '1.5'
    letterSpacing: -0.165px
  body:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: '1.5'
  body-small:
    fontFamily: Inter
    fontSize: 0.813rem
    fontWeight: '400'
    lineHeight: '1.5'
  label:
    fontFamily: Inter
    fontSize: 0.813rem
    fontWeight: '560'
    lineHeight: '1.5'
    letterSpacing: -0.13px
  caption:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '450'
    lineHeight: '1.4'
  mono:
    fontFamily: JetBrains Mono
    fontSize: 0.813rem
    fontWeight: '400'
    lineHeight: '1.5'
  mono-label:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 16px
  margin: 24px
  space-xs: 4px
  space-sm: 8px
  space-md: 12px
  space-lg: 16px
  space-xl: 24px
  space-2xl: 32px
  space-3xl: 48px
---

## Brand & Style

This design system establishes a unified visual language for an interconnected suite of enterprise applications—Identity Hub, Platform, Helpdesk, and Code Review. The aesthetic prioritizes density over decoration, conveying precision, operational reliability, and calm authority. 

- **Target Audience:** Engineers, IT administrators, support agents, and technical operators who value speed, information density, and low-cognitive-load interfaces.
- **Emotional Response:** Trust, focus, clarity, and control.
- **Design Style:** Modern Corporate / Minimalist Enterprise. It relies on subtle off-white surfaces, crisp hairline borders, layered soft shadows, and a singular, purposeful violet accent to guide attention without distraction.

## Colors

The color palette is deliberately restrained, anchored by deep near-black text and a structured off-white canvas (`#f7f7f8`). Pure white (`#ffffff`) is reserved strictly for interactive panels and cards to create immediate spatial hierarchy. 

- **Primary Accent:** A single focused violet (`#6e5ae6`) drives interactive states, active navigation, and primary actions. Never introduce a secondary accent color or decorative gradients.
- **Semantics:** Status indicators (success, warning, danger, critical) must always combine hue, soft background tints, and explicit text labels or icons to ensure full accessibility.
- **Borders & Surfaces:** Rely on subtle rgba borders (`rgba(15,23,42,0.10)`) to segment data dense layouts before ever reaching for drop shadows.

## Typography

Typography is optimized for high-density information display. *Inter* serves as the primary humanist sans-serif typeface across all UI elements, utilizing stylistic sets (`cv01`, `ss03`) for enhanced legibility at smaller scales. *JetBrains Mono* is strictly reserved for code blocks, diff views, technical logs, and metadata labels. 

- Maintain tight, proportional line heights to fit maximum context without vertical scrolling fatigue.
- Use font weight variations (400, 450, 560, 590) rather than scale inflation to establish hierarchy within compact panels.

## Layout & Spacing

The application shell relies on a fixed, structural layout model rather than a fluid percentage grid. Every app page enforces a deterministic shell architecture: a 56px navigation rail, a 236px contextual sidebar, and a 48px topbar. 

- **Alignment:** Left-align all content and text blocks by default. Center alignment is strictly prohibited except for specialized auth cards (380px) and Hub landing cards (560px).
- **Rhythm:** Spacing follows a strict geometric progression (4px, 8px, 12px, 16px, 24px, 32px, 48px). Never introduce arbitrary spacing values outside this scale.

## Elevation & Depth

Visual hierarchy is communicated primarily through flat structural boundaries and disciplined layering rather than heavy skeuomorphism. 

- **Hairline Borders:** The default boundary treatment utilizes crisp, low-opacity strokes (`rgba(15,23,42,0.10)`) to separate adjacent panels and table rows.
- **Layered Soft Shadows:** When elevation is required (such as floating nodes, dropdowns, or modal dialogs), combine tight structural outlines with multi-tiered, diffuse shadows tinted toward the base slate hue (`rgba(15,23,42,0.06)` to `0.16`). This maintains a crisp, modern light-mode atmosphere without muddying the canvas.

## Shapes

The shape language is tight, purposeful, and structured, reflecting a soft-cornered modern utility aesthetic (`roundedness: 1`).

- **Radius Scale:** 
  - `sm` (4px): Small UI components, internal tags, and inner badges.
  - `md` (6px): Standard interactive elements, buttons, input fields, and list items.
  - `lg` (8px): Containers, panels, workflow nodes, and cards.
  - `xl` (12px): Modals and high-level dialog containers.
  - `full` (9999px): Avatars, online presence indicators, and pill badges.
- Avoid pill-shaped buttons or oversized, organic radiuses; all shapes must reinforce technical precision and data organization.

## Components

All components must adhere strictly to the tokenized specifications to ensure seamless visual continuity across Identity Hub, Platform, Helpdesk, and Code Review.

- **Buttons:** Primary buttons use the solid violet accent (`#6e5ae6`) with white text and `md` rounded corners. Ghost and secondary variants rely on subtle panel backgrounds and precise padding (`7px 14px`) using the `label` typography token. Icon buttons maintain a fixed square footprint (30x30px) with circular or softly rounded bounds.
- **Input Fields:** Form controls feature white backgrounds (`surface-panel`), standard hairline borders, and `body` text styling, ensuring high legibility during data entry.
- **Lists & Tables:** List items and table rows support distinct interactive states (hover via `surface-hover`, active via `surface-accent-tint`). Table headers utilize `mono-label` typography on `surface-page` backgrounds for clear metadata differentiation.
- **Cards & Panels:** Elevated containers utilize pure white surfaces against the off-white page canvas, grounded by hairline borders and subtle card shadows.
- **Badges & Indicators:** Status chips and badges combine soft tonal backgrounds with deep text hues, paired with 8px status dots (online, unread, critical severity) to reinforce scannability.
- **Code & Diffs:** Code Review components leverage `JetBrains Mono`, with dedicated context, addition, and removal background tints for clear patch analysis.