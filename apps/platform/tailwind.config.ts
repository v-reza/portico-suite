const preset = require('@portico/tokens/tailwind-preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  presets: [preset],
  theme: { extend: {} },
  plugins: [],
};
