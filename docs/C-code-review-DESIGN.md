---
version: alpha
name: CodeReview-Light
description: AI PR review dashboard, light-first. Off-white page, white panels, hairline borders, layered soft shadows, single violet accent; severity encoded by hue + tint + dot + label. Data-dense, findings-heavy.
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
  critical: "#b91c1c"
  surface-page: "#f7f7f8"
  surface-panel: "#ffffff"
  surface-elevated: "#ffffff"
  surface-hover: "#f1f1f3"
  surface-sunken: "#ededf0"
  surface-accent-tint: "#f2f0fe"
  border-subtle: "rgba(15,23,42,0.06)"
  border-standard: "rgba(15,23,42,0.10)"
  text-primary: "#101014"
  text-secondary: "#4b5058"
  text-tertiary: "#62676f"
  text-quaternary: "#9aa0aa"
  overlay: "rgba(16,16,20,0.40)"
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
  dialog: "0 16px 48px rgba(15,23,42,0.16), 0 4px 12px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.10)"
components:
  page: { backgroundColor: "{colors.surface-page}" }
  rail: { backgroundColor: "{colors.surface-panel}", width: 56 }
  rail-item: { backgroundColor: "{colors.surface-panel}", textColor: "{colors.text-secondary}", rounded: "{rounded.md}", size: 32 }
  rail-item-hover: { backgroundColor: "{colors.surface-hover}" }
  rail-item-active: { backgroundColor: "{colors.surface-accent-tint}", textColor: "{colors.accent-hover}" }
  topbar: { backgroundColor: "{colors.surface-panel}", height: 48 }
  panel: { backgroundColor: "{colors.surface-panel}", rounded: "{rounded.lg}" }
  card: { backgroundColor: "{colors.surface-elevated}", rounded: "{rounded.lg}" }
  card-hover: { backgroundColor: "{colors.surface-hover}" }
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
  button-primary: { backgroundColor: "{colors.accent}", textColor: "#ffffff", rounded: "{rounded.md}", padding: "7px 14px", typography: "{typography.label}" }
  button-primary-hover: { backgroundColor: "{colors.accent-hover}" }
  button-ghost: { backgroundColor: "{colors.surface-panel}", textColor: "{colors.text-secondary}", rounded: "{rounded.md}", padding: "7px 14px", typography: "{typography.label}" }
  button-ghost-hover: { backgroundColor: "{colors.surface-hover}" }
  button-danger: { backgroundColor: "{colors.danger-solid}", textColor: "#ffffff", rounded: "{rounded.md}", padding: "7px 14px", typography: "{typography.label}" }
  input: { backgroundColor: "{colors.surface-panel}", textColor: "{colors.text-primary}", rounded: "{rounded.md}", padding: "7px 11px", typography: "{typography.body}" }
  stats-card: { backgroundColor: "{colors.surface-elevated}", rounded: "{rounded.lg}", padding: "16px" }
  stats-value: { textColor: "{colors.text-primary}", typography: "display-xl" }
  stats-label: { textColor: "{colors.text-tertiary}", typography: "mono-label" }
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
  sidebar-item-active: { backgroundColor: "{colors.surface-accent-tint}", textColor: "{colors.accent-hover}" }
  sidebar-item-hover: { backgroundColor: "{colors.surface-hover}" }
  modal: { backgroundColor: "{colors.surface-elevated}", rounded: "{rounded.xl}" }
  modal-overlay: { backgroundColor: "{colors.overlay}" }
  tooltip: { backgroundColor: "#101014", textColor: "#ffffff", rounded: "{rounded.md}" }

---

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
| `finding-critical` | borderLeft `3px solid {colors.critical}`, border `{colors.border-subtle}` |
| `finding-high` | borderLeft `3px solid {colors.danger}`, border `{colors.border-subtle}` |
| `finding-medium` | borderLeft `3px solid {colors.warning}`, border `{colors.border-subtle}` |
| `finding-low` | borderLeft `3px solid {colors.text-quaternary}`, border `{colors.border-subtle}` |
| `diff-code` | border `{colors.border-standard}` |
| `diff-added-line` | borderLeft `2px solid {colors.diff-added-gutter}` |
| `diff-removed-line` | borderLeft `2px solid {colors.diff-removed-gutter}` |
| `severity-badge-text` | severity WAJIB dot + label teks, bukan warna saja |
| `button-ghost` | border `{colors.border-standard}` |
| `input` | border `{colors.border-standard}` |
| `input-focus` | borderColor `{colors.accent}`, boxShadow `0 0 0 3px rgba(110,90,230,0.18)` |
| `select` | extends `input` |
| `stats-card` | border `{colors.border-subtle}`, boxShadow `{elevation.card}` |
| `chart-grid` | stroke `rgba(15,23,42,0.06)`, no horizontal lines | 
| `chart-line` | stroke `{colors.accent}`, strokeWidth `2` |
| `chart-area` | fill `{colors.accent}`, opacity `0.08` |
| `chart-bar-critical` | fill `{colors.critical}` |
| `chart-bar-high` | fill `{colors.danger}` |
| `chart-bar-medium` | fill `{colors.warning}` |
| `chart-bar-low` | fill `{colors.text-quaternary}` |
| `sidebar` | borderRight `{colors.border-standard}` |
| `modal` | border `{colors.border-standard}`, boxShadow `{elevation.dialog}` |
| `tooltip` | boxShadow `{elevation.elevated}` |
