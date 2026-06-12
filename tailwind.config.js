/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        primary: {
          50: '#F5F1EE',
          100: '#E8DFD8',
          200: '#D1BFB3',
          300: '#B89B88',
          400: '#9E7A5E',
          500: '#8B5A2B',
          600: '#6F4820',
          700: '#543618',
          800: '#3E2723',
          900: '#2C1810',
        },
        accent: {
          50: '#FEF9E7',
          100: '#FDF0C4',
          200: '#FBE089',
          300: '#F7CE4C',
          400: '#E8B931',
          500: '#D4AF37',
          600: '#B8912E',
          700: '#967325',
          800: '#7A5C1E',
          900: '#634A18',
        },
        cream: {
          50: '#FDFCFA',
          100: '#FAFAF5',
          200: '#F5F3EB',
          300: '#EDEBDF',
          400: '#E2DED0',
          500: '#D4CFC0',
        },
      },
      fontFamily: {
        serif: ['"Source Han Serif SC"', '"Noto Serif SC"', 'Georgia', 'serif'],
        sans: ['"Source Han Sans SC"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'book': '0 4px 20px rgba(62, 39, 35, 0.15)',
        'book-hover': '0 8px 30px rgba(62, 39, 35, 0.25)',
        'gold': '0 4px 20px rgba(212, 175, 55, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-gold': 'pulseGold 2s infinite',
        'countdown': 'countdown 1s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212, 175, 55, 0.4)' },
          '50%': { boxShadow: '0 0 0 10px rgba(212, 175, 55, 0)' },
        },
        countdown: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
      },
    },
  },
  plugins: [],
};
