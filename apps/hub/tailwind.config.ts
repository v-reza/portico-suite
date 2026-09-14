import type { Config } from 'tailwindcss';
import preset from '@portico/tokens/tailwind-preset';

const config: Config = {
  presets: [preset],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // alias the Stitch-generated arbitrary classes expect
        background: 'var(--neutral)',
        foreground: 'var(--primary)',
        muted: 'var(--tertiary)',
      },
      borderColor: {
        DEFAULT: 'rgba(15, 23, 42, 0.10)',
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [
    function ({ addUtilities }: any) {
      addUtilities({
        '.hairline-border': {
          border: '1px solid rgba(15, 23, 42, 0.10)',
        },
        '.card-shadow': {
          boxShadow:
            '0 1px 2px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.08)',
        },
        '.font-mono-jb': {
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        },
        '.hairline-divide-y > :not([hidden]) ~ :not([hidden])': {
          borderTop: '1px solid rgba(15, 23, 42, 0.10)',
        },
        '.selection-accent::selection': {
          backgroundColor: 'var(--surface-accent-tint)',
          color: 'var(--accent)',
        },
      });
    },
  ],
};

export default config;
