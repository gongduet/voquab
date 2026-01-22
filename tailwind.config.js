/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Notion-like primary (blue, used sparingly)
        primary: {
          50: '#f8fafc',
          100: '#eff6ff',
          200: '#dbeafe',
          300: '#bfdbfe',
          400: '#60a5fa',
          500: '#2563eb',  // Main accent
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#1e3a8a',
        },
        // Muted amber for books (less saturated)
        amber: {
          50: '#fefdfb',
          100: '#fdf8f0',
          200: '#faecd8',
          300: '#f5dbb5',
          400: '#e5bc7a',
          500: '#d4a24e',  // Muted gold
          600: '#b8862f',
          700: '#956b25',
          800: '#7a5820',
          900: '#63481c',
        },
        // Muted purple for songs (less saturated)
        purple: {
          50: '#faf9fb',
          100: '#f4f2f7',
          200: '#e9e5ef',
          300: '#d9d2e3',
          400: '#b5a8c7',
          500: '#8b7aa3',  // Muted purple
          600: '#6f5d8a',
          700: '#594a70',
          800: '#483c5b',
          900: '#3b314a',
        },
        // Notion-like neutrals
        neutral: {
          50: '#fafafa',   // Page background
          100: '#f5f5f5',
          200: '#e5e5e5',  // Borders
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#6b7280',  // Secondary text
          600: '#525252',
          700: '#404040',
          800: '#37352f',  // Primary text (Notion brown-black)
          900: '#1c1917',
        },
        // Semantic colors (muted versions)
        success: {
          50: '#f7fdf9',
          100: '#dcfce7',
          500: '#4ade80',
          600: '#22c55e',
          700: '#15803d',
        },
        error: {
          50: '#fef7f7',
          100: '#fee2e2',
          500: '#f87171',
          700: '#b91c1c',
        },
        warning: {
          50: '#fffbf5',
          100: '#ffedd5',
          500: '#fb923c',
          700: '#c2410c',
        },
        info: {
          50: '#f8fafc',
          100: '#dbeafe',
          500: '#60a5fa',
          700: '#1d4ed8',
        },
        // Landing page dark theme
        landing: {
          bg: '#0f172a',
          'bg-secondary': '#1e293b',
          'bg-accent': '#334155',
          text: '#f8f5f0',
          muted: '#94a3b8',
          'muted-dark': '#64748b',
          accent: '#d4a574',
          'accent-hover': '#e5b885',
          border: '#334155',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
        // Landing page fonts
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
