/**
 * Tailwind preset for every app in the suite.
 *
 * Values are read from the same generated `tokens.ts` the CSS vars come from,
 * so a token change in docs/PORTICO-SUITE-DESIGN.md propagates to both Tailwind
 * utilities and raw CSS with one `npm run tokens:build`.
 *
 * Apps add this in tailwind.config.ts:
 *   import preset from '@portico/tokens/tailwind-preset';
 *   export default { presets: [preset], content: [...] };
 */

import { colors, rounded, spacing, elevation } from './dist/tokens.mjs';

/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        // bare names: text-primary, bg-surface-panel, border-border-standard…
        ...colors,
        accent: {
          DEFAULT: colors.accent,
          hover: colors['accent-hover'],
        },
      },
      borderRadius: {
        sm: rounded.sm,
        md: rounded.md,
        lg: rounded.lg,
        xl: rounded.xl,
        full: rounded.full,
      },
      spacing: {
        ...spacing,
        // shell dimensions, so `w-rail` / `w-sidebar` are available
        rail: '56px',
        sidebar: '236px',
        topbar: '48px',
        'list-pane': '340px',
        'list-row': '44px',
      },
      boxShadow: {
        hairline: elevation.hairline,
        card: elevation.card,
        elevated: elevation.elevated,
        node: elevation.node,
        dialog: elevation.dialog,
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // 9 steps from DESIGN.md typography
        'display-xl': ['2rem', { lineHeight: '1.13', letterSpacing: '-0.704px', fontWeight: '590' }],
        'heading-section': ['1.25rem', { lineHeight: '1.33', letterSpacing: '-0.24px', fontWeight: '590' }],
        'heading-card': ['1rem', { lineHeight: '1.5', letterSpacing: '-0.165px', fontWeight: '560' }],
        body: ['0.875rem', { lineHeight: '1.5' }],
        'body-small': ['0.813rem', { lineHeight: '1.5' }],
        label: ['0.813rem', { lineHeight: '1.5', letterSpacing: '-0.13px', fontWeight: '560' }],
        caption: ['0.75rem', { lineHeight: '1.4', fontWeight: '450' }],
        mono: ['0.813rem', { lineHeight: '1.5' }],
        'mono-label': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
    },
  },
};
