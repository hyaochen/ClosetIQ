/** @type {import('tailwindcss').Config} */
// tokens 與 lib/theme.ts 保持一致。淺色為預設；深色用 dark:bg-paper-dark 之類的 -dark 色。
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: '#F4F0E8', dark: '#161513' },
        card: { DEFAULT: '#E9E2D4', dark: '#242220' },
        tile: { DEFAULT: '#E9E2D4', dark: '#A39C90' },
        ink: { DEFAULT: '#1A1917', dark: '#EDE7DC' },
        mute: { DEFAULT: '#5E5A53', dark: '#A59E92' },
        line: { DEFAULT: '#CFC7B8', dark: '#3D3933' },
        accent: { DEFAULT: '#A8472A', dark: '#D0794F' },
        olive: { DEFAULT: '#4F5B3A', dark: '#9AAA78' },
      },
      fontFamily: {
        serif: ["'Noto Serif TC'", 'serif'],
        sans: ["'Noto Sans TC'", 'sans-serif'],
        numeral: ["'Cormorant Garamond'", 'serif'],
      },
      borderRadius: {
        none: '0px',
        sm: '1px',
        DEFAULT: '2px',
      },
    },
  },
  plugins: [],
};
