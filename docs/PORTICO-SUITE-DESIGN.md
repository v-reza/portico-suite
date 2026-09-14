---
version: alpha
name: Portico-Suite-Light
description: Shared visual language for the Portico suite: identity Hub + three apps (Platform, Helpdesk, Code Review). Light-first, off-white page, white panels, hairline borders, layered soft shadows, single violet accent. Density over decoration. One token set, so all four surfaces read as one product.
colors:
  primary: "#101014"
  secondary: "#4b5058"
  tertiary: "#62676f"
  neutral: "#f7f7f8"
  accent: "#6e5ae6"
  accent-hover: "#5b46d6"
  info: "#6e5ae6"
  success: "#16a34a"
  warning: "#d97706"
  danger: "#dc2626"
  danger-solid: "#dc2626"
  surface-page: "#f7f7f8"
  surface-panel: "#ffffff"
  surface-elevated: "#ffffff"
  surface-hover: "#f1f1f3"
  surface-sunken: "#ededf0"
  surface-canvas: "#f1f1f4"
  surface-accent-tint: "#f2f0fe"
  border-subtle: "rgba(15,23,42,0.06)"
  border-standard: "rgba(15,23,42,0.10)"
  text-primary: "#101014"
  text-secondary: "#4b5058"
  text-tertiary: "#62676f"
  overlay: "rgba(16,16,20,0.40)"
  critical: "#b91c1c"
  critical-tint: "#fdecec"
  text-quaternary: "#9aa0aa"
  diff-added-bg: "rgba(22,163,74,0.10)"
  diff-added-gutter: "rgba(22,163,74,0.22)"
  diff-removed-bg: "rgba(220,38,38,0.08)"
  diff-removed-gutter: "rgba(220,38,38,0.22)"
  diff-context-bg: "#fbfbfc"
typography:
  display-xl:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: 590
    lineHeight: 1.13
    letterSpacing: "-0.704px"
    fontFeature: '"cv01", "ss03"'
  heading-section:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: 590
    lineHeight: 1.33
    letterSpacing: "-0.24px"
    fontFeature: '"cv01", "ss03"'
  heading-card:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 560
    lineHeight: 1.5
    letterSpacing: "-0.165px"
    fontFeature: '"cv01", "ss03"'
  body:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: '"cv01", "ss03"'
  body-small:
    fontFamily: Inter
    fontSize: 0.813rem
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: '"cv01", "ss03"'
  label:
    fontFamily: Inter
    fontSize: 0.813rem
    fontWeight: 560
    lineHeight: 1.5
    letterSpacing: "-0.13px"
    fontFeature: '"cv01", "ss03"'
  caption:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 450
    lineHeight: 1.4
    fontFeature: '"cv01", "ss03"'
  mono:
    fontFamily: JetBrains Mono
    fontSize: 0.813rem
    fontWeight: 400
    lineHeight: 1.5
  mono-label:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.4
rounded: { sm: 4px, md: 6px, lg: 8px, xl: 12px, full: 9999px }
spacing: { xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 24px, "2xl": 32px, "3xl": 48px }
elevation:
  flat: "none"
  hairline: "0 0 0 1px rgba(15,23,42,0.10)"
  card: "0 1px 2px rgba(15,23,42,0.06), 0 0 0 1px rgba(15,23,42,0.08)"
  elevated: "0 2px 4px rgba(15,23,42,0.06), 0 6px 16px rgba(15,23,42,0.06), 0 0 0 1px rgba(15,23,42,0.08)"
  node: "0 1px 2px rgba(15,23,42,0.08), 0 4px 12px rgba(15,23,42,0.06), 0 0 0 1px rgba(15,23,42,0.10)"
  dialog: "0 16px 48px rgba(15,23,42,0.16), 0 4px 12px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.10)"
components:
  page: { backgroundColor: "{colors.surface-page}" }
  rail: { backgroundColor: "{colors.surface-panel}", width: 56 }
  rail-item: { backgroundColor: "{colors.surface-panel}", textColor: "{colors.text-secondary}", rounded: "{rounded.md}", size: 32 }
  rail-item-hover: { backgroundColor: "{colors.surface-hover}" }
  rail-item-active: { backgroundColor: "{colors.surface-accent-tint}", textColor: "{colors.accent-hover}" }
  topbar: { backgroundColor: "{colors.surface-panel}", height: 48 }
  panel: { backgroundColor: "{colors.surface-panel}", rounded: "{rounded.lg}" }
  canvas: { backgroundColor: "{colors.surface-canvas}", rounded: "{rounded.lg}" }
  card: { backgroundColor: "{colors.surface-elevated}", rounded: "{rounded.lg}" }
  card-hover: { backgroundColor: "{colors.surface-hover}" }
  palette-item: { backgroundColor: "{colors.surface-panel}", textColor: "{colors.text-secondary}", rounded: "{rounded.md}", padding: "6px 10px", typography: "{typography.label}" }
  palette-item-hover: { backgroundColor: "{colors.surface-hover}" }
  drag-overlay: { backgroundColor: "{colors.surface-accent-tint}", rounded: "{rounded.md}" }
  drop-zone: { backgroundColor: "{colors.surface-panel}", rounded: "{rounded.md}", padding: "24px" }
  button-primary: { backgroundColor: "{colors.accent}", textColor: "#ffffff", rounded: "{rounded.md}", padding: "7px 14px", typography: "{typography.label}" }
  button-primary-hover: { backgroundColor: "{colors.accent-hover}" }
  button-danger: { backgroundColor: "{colors.danger-solid}", textColor: "#ffffff", rounded: "{rounded.md}", padding: "7px 14px", typography: "{typography.label}" }
  button-ghost: { backgroundColor: "{colors.surface-panel}", textColor: "{colors.text-secondary}", rounded: "{rounded.md}", padding: "7px 14px", typography: "{typography.label}" }
  button-ghost-hover: { backgroundColor: "{colors.surface-hover}" }
  button-icon: { backgroundColor: "{colors.surface-panel}", textColor: "{colors.text-secondary}", rounded: "50%", padding: "8px", width: "30px", height: "30px" }
  input: { backgroundColor: "{colors.surface-panel}", textColor: "{colors.text-primary}", rounded: "{rounded.md}", padding: "7px 11px", typography: "{typography.body}" }
  workflow-node: { backgroundColor: "{colors.surface-elevated}", rounded: "{rounded.lg}", padding: "11px 14px" }
  workflow-handle: { backgroundColor: "{colors.accent}", width: 8, height: 8 }
  avatar: { backgroundColor: "{colors.surface-sunken}", textColor: "{colors.text-secondary}", rounded: "50%", size: 26 }
  list-item: { backgroundColor: "{colors.surface-panel}", rounded: "{rounded.md}", padding: "8px 10px" }
  list-item-hover: { backgroundColor: "{colors.surface-hover}" }
  list-item-active: { backgroundColor: "{colors.surface-accent-tint}", rounded: "{rounded.md}" }
  dot-online: { backgroundColor: "#16a34a", rounded: "50%", width: 8, height: 8 }
  dot-unread: { backgroundColor: "{colors.accent}", rounded: "50%", width: 8, height: 8 }
  dot-critical: { backgroundColor: "{colors.danger}", rounded: "50%", width: 8, height: 8 }
  badge-success: { backgroundColor: "#e8f6ee", textColor: "#15803d", rounded: "{rounded.full}", padding: "2px 8px", typography: "{typography.caption}" }
  badge-danger: { backgroundColor: "#fdecec", textColor: "#b91c1c", rounded: "{rounded.full}", padding: "2px 8px", typography: "{typography.caption}" }
  badge-warning: { backgroundColor: "#fdf1e3", textColor: "#b45309", rounded: "{rounded.full}", padding: "2px 8px", typography: "{typography.caption}" }
  badge-neutral: { backgroundColor: "{colors.surface-panel}", textColor: "{colors.text-secondary}", rounded: "{rounded.full}", padding: "2px 10px", typography: "{typography.caption}" }
  badge-accent: { backgroundColor: "{colors.surface-accent-tint}", textColor: "#5b46d6", rounded: "{rounded.full}", padding: "2px 8px", typography: "{typography.caption}" }
  table-header: { backgroundColor: "{colors.surface-page}", textColor: "{colors.text-tertiary}", typography: "{typography.mono-label}" }
  table-row: { backgroundColor: "{colors.surface-panel}" }
  table-row-hover: { backgroundColor: "{colors.surface-hover}" }
  sidebar: { backgroundColor: "{colors.surface-panel}", width: 236 }
  sidebar-item: { textColor: "{colors.text-secondary}", rounded: "{rounded.md}", padding: "6px 10px", typography: "{typography.body-small}" }
  sidebar-item-hover: { backgroundColor: "{colors.surface-hover}" }
  sidebar-item-active: { backgroundColor: "{colors.surface-accent-tint}", textColor: "{colors.accent-hover}" }
  inspector: { backgroundColor: "{colors.surface-panel}", width: 280, padding: "16px" }
  inspector-label: { textColor: "{colors.text-tertiary}", typography: "{typography.mono-label}" }
  modal: { backgroundColor: "{colors.surface-elevated}", rounded: "{rounded.xl}" }
  modal-overlay: { backgroundColor: "{colors.overlay}" }
  tooltip: { backgroundColor: "#101014", textColor: "#ffffff", rounded: "{rounded.md}" }
  rail-count: { backgroundColor: "{colors.surface-sunken}", textColor: "{colors.text-tertiary}", rounded: "{rounded.full}", padding: "1px 6px", typography: "{typography.mono-label}" }
  rail-count-danger: { backgroundColor: "#fdecec", textColor: "#b91c1c", rounded: "{rounded.full}", padding: "1px 6px", typography: "{typography.mono-label}" }
  thread-bubble-in: { backgroundColor: "{colors.surface-sunken}", rounded: "{rounded.lg}", padding: "10px 12px", typography: "{typography.body}" }
  thread-bubble-out: { backgroundColor: "{colors.surface-accent-tint}", rounded: "{rounded.lg}", padding: "10px 12px", typography: "{typography.body}" }
  internal-note: { backgroundColor: "rgba(217,119,6,0.07)", rounded: "{rounded.md}", padding: "10px 12px" }
  composer: { backgroundColor: "{colors.surface-elevated}", rounded: "{rounded.lg}", padding: "10px 12px" }
  finding-critical: { backgroundColor: "rgba(185,28,28,0.06)", rounded: "{rounded.md}" }
  finding-high: { backgroundColor: "rgba(220,38,38,0.04)", rounded: "{rounded.md}" }
  finding-medium: { backgroundColor: "rgba(217,119,6,0.05)", rounded: "{rounded.md}" }
  finding-low: { backgroundColor: "{colors.surface-panel}", rounded: "{rounded.md}" }
  diff-code: { backgroundColor: "{colors.diff-context-bg}", rounded: "{rounded.md}", typography: "{typography.mono}" }
  diff-added-line: { backgroundColor: "{colors.diff-added-bg}" }
  diff-removed-line: { backgroundColor: "{colors.diff-removed-bg}" }
  severity-dot-critical: { backgroundColor: "{colors.critical}", rounded: "50%", width: 8, height: 8 }
  severity-dot-high: { backgroundColor: "{colors.danger}", rounded: "50%", width: 8, height: 8 }
  severity-dot-medium: { backgroundColor: "{colors.warning}", rounded: "50%", width: 8, height: 8 }
  severity-dot-low: { backgroundColor: "{colors.text-quaternary}", rounded: "50%", width: 8, height: 8 }
  stats-card: { backgroundColor: "{colors.surface-elevated}", rounded: "{rounded.lg}", padding: "16px" }
  stats-value: { textColor: "{colors.text-primary}", typography: "display-xl" }
  stats-label: { textColor: "{colors.text-tertiary}", typography: "mono-label" }
---

## Overview

Portico is the identity hub; Platform, Helpdesk and Code Review are the three apps
behind it. They share one visual language: off-white page, white panels, hairline
borders, layered soft shadows, and a single violet accent for every interactive
element. Nothing is decorated for its own sake.

This file merges the three per-app token sets. All core colours, all nine typography
scales, all five radii and all seven spacing steps were byte-identical across the
three apps, so they appear once here. App-specific components (workflow nodes for
Platform, diff and severity for Code Review) are kept and named by feature.

## Colors

- **Primary (#101014):** text and headings.
- **Accent (#6e5ae6):** the only driver for interaction. Hover #5b46d6.
- **Surface:** page #f7f7f8, panel #ffffff, hover #f1f1f3, sunken #ededf0,
  accent tint #f2f0fe.
- **Status:** success #16a34a, warning #d97706, danger #dc2626,
  critical #b91c1c (Code Review severity only).

## Typography

Inter for everything except small all-caps labels and numeric data, which use
JetBrains Mono. Weight 590 for display and section headings, 560 for card
headings, 400 for body.

## Shapes

Radius 6px inputs, 8px cards and panels, 12px modals only, full for pills.
Nothing else.

## Do's and Don'ts

- Do keep page #f7f7f8 and panels #ffffff. Never a white page.
- Do use hairline rgba(15,23,42,0.10) borders before reaching for a shadow.
- Do encode severity with hue + tint + dot + text label, never colour alone.
- Don't add gradients, glassmorphism, pure black, or a second accent colour.
- Don't invent a radius, a spacing step, or a colour outside this file.

## Components

`button-primary` is the only high-emphasis action on a page. Shell components
(`rail` 56px, `sidebar` 236px, `topbar` 48px) are fixed; every shell page carries
all three.

## 🧩 Sub-token per komponen (struktural)

Di luar skema validasi `designmd` (hanya `backgroundColor`, `textColor`, `typography`,
`rounded`, `padding`, `size`, `height`, `width`), jadi ditulis di sini. Tetap dipakai
saat generate komponen.

| Komponen | Sub-token |
|---|---|
| `avatar` | border `{colors.border-subtle}` |
| `dot-online` | warna `#16a34a`, tanpa border |
| `dot-unread` | warna `{colors.accent}`, tanpa border |
| `dot-critical` | warna `{colors.danger}`, tanpa border |
| `list-item` | borderBottom `{colors.border-subtle}` |
| `list-item-active` | borderLeft `2px solid {colors.accent}` |
| `badge-neutral` | border `{colors.border-standard}` |
| `badge-accent` | border `1px solid rgba(110,90,230,0.20)` |
| `table-header` | borderBottom `{colors.border-standard}` |
| `table-row` | borderBottom `{colors.border-subtle}` |
| `topbar` | borderBottom `{colors.border-standard}` |
| `rail` | borderRight `{colors.border-standard}` |
| `rail-item` | border `1px solid transparent` |
| `rail-item-active` | border `1px solid rgba(110,90,230,0.20)` |
| `panel` | border `{colors.border-standard}`, boxShadow `{elevation.card}` |
| `card` | border `{colors.border-subtle}`, boxShadow `{elevation.card}` |
| `canvas` | border `{colors.border-standard}` |
| `palette-item` | border `1px solid transparent` |
| `palette-item-hover` | border `{colors.border-subtle}` |
| `drag-overlay` | border `1px dashed {colors.accent}` |
| `drop-zone` | border `1px dashed rgba(15,23,42,0.18)` |
| `button-ghost` | border `{colors.border-standard}` |
| `button-icon` | border `{colors.border-standard}` |
| `input` | border `{colors.border-standard}` |
| `input-focus` | borderColor `{colors.accent}`, boxShadow `0 0 0 3px rgba(110,90,230,0.18)` |
| `select` | extends `input` |
| `workflow-node` | border `{colors.border-standard}`, boxShadow `{elevation.node}` |
| `workflow-node-selected` | borderColor `{colors.accent}`, boxShadow `0 0 0 3px rgba(110,90,230,0.20)` |
| `workflow-edge` | stroke `rgba(15,23,42,0.14)`, strokeWidth `2` |
| `workflow-edge-active` | stroke `{colors.accent}`, strokeWidth `2` |
| `sidebar` | borderRight `{colors.border-standard}` |
| `inspector` | borderLeft `{colors.border-standard}` |
| `inspector-label` | marginBottom `4px` |
| `modal` | border `{colors.border-standard}`, boxShadow `{elevation.dialog}` |
| `tooltip` | boxShadow `{elevation.elevated}` |
| `rail-item-hover` | border `1px solid transparent` |
| `list-item-unread-dot` | width `6px`, height `6px`, background `{colors.accent}`, rounded `50%` |
| `thread-bubble-in` | border `{colors.border-subtle}` |
| `thread-bubble-out` | border `1px solid rgba(110,90,230,0.18)` |
| `internal-note` | borderLeft `2px solid {colors.warning}` |
| `composer` | border `{colors.border-standard}`, boxShadow `{elevation.hairline}` |
| `textarea` | extends `input` |
| `rail-count` | border `{colors.border-standard}` |
| `finding-critical` | borderLeft `3px solid {colors.critical}`, border `{colors.border-subtle}` |
| `finding-high` | borderLeft `3px solid {colors.danger}`, border `{colors.border-subtle}` |
| `finding-medium` | borderLeft `3px solid {colors.warning}`, border `{colors.border-subtle}` |
| `finding-low` | borderLeft `3px solid {colors.text-quaternary}`, border `{colors.border-subtle}` |
| `diff-code` | border `{colors.border-standard}` |
| `diff-added-line` | borderLeft `2px solid {colors.diff-added-gutter}` |
| `diff-removed-line` | borderLeft `2px solid {colors.diff-removed-gutter}` |
| `severity-badge-text` | severity WAJIB dot + label teks, bukan warna saja |
| `stats-card` | border `{colors.border-subtle}`, boxShadow `{elevation.card}` |
| `chart-grid` | stroke `rgba(15,23,42,0.06)`, no horizontal lines | 
| `chart-line` | stroke `{colors.accent}`, strokeWidth `2` |
| `chart-area` | fill `{colors.accent}`, opacity `0.08` |
| `chart-bar-critical` | fill `{colors.critical}` |
| `chart-bar-high` | fill `{colors.danger}` |
| `chart-bar-medium` | fill `{colors.warning}` |
| `chart-bar-low` | fill `{colors.text-quaternary}` |
