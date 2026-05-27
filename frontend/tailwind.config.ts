/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sand: {
          50: '#fcfbf9',
          100: '#f7f5f2',
          200: '#efece6',
          300: '#e5e0d7',
          400: '#d4cdc0',
          500: '#bfb5a4',
          600: '#a89b88',
          700: '#8f806d',
          800: '#766858',
          900: '#5e5248',
        },
        sage: {
          50: '#f6f7f5',
          100: '#ecefe9',
          200: '#d8e0d0',
          300: '#c0cfae',
          400: '#a3b88c',
          500: '#849f6b',
          600: '#698152',
          700: '#566846',
          800: '#435238',
          900: '#34422d',
        },
        crust: {
          50: '#fdf8f3',
          100: '#faf0e4',
          200: '#f3e0ca',
          300: '#ebd0aa',
          400: '#e0b88a',
          500: '#d4a06a',
          600: '#c98a52',
          700: '#a87345',
          800: '#8a603e',
          900: '#6e4b30',
        },
        swiggy: {
          DEFAULT: '#fc8019',
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#fc8019',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        brand: {
          dark:   '#1c1917',
          card:   '#fafaf9',
          text:   '#44403c',
          subtle: '#78716c',
          muted:  '#a8a29e',
          border: '#e7e5e4',
          bg:     '#fafaf8',
          white:  '#ffffff',
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        outfit: ['var(--font-outfit)', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
