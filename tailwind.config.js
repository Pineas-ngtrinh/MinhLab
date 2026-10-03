/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./index.html",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0F14',
        'background-soft': '#0F141A',
        surface: '#141A21',
        'surface-elevated': '#1A222C',
        'surface-hover': '#202A35',
        'text-primary': '#F4F1EA',
        'text-secondary': '#A5ADB8',
        'text-muted': '#737D89',
        border: '#27313C',
        'border-soft': 'rgba(255, 255, 255, 0.08)',
        brand: {
          DEFAULT: '#EB4037',
          hover: '#FF5147',
          soft: 'rgba(235, 64, 55, 0.12)',
        },
        'warm-light': '#D48955',
        technical: '#8492BD',
        success: '#6F9576',
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        subtle: '0 4px 20px rgba(0, 0, 0, 0.35)',
        elevated: '0 12px 40px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
};
