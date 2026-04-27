/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        space: {
          bg: '#060b18',
          card: '#0d1526',
          border: '#1e2d4a',
          accent: '#4f8ef7',
          funded: '#22c55e',
          warn: '#f59e0b',
          danger: '#ef4444',
          muted: '#64748b',
          text: '#f1f5f9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease',
        'slide-up': 'slideUp 0.3s ease',
        'count-up': 'countUp 1s ease-out',
        'star-twinkle': 'twinkle 3s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        twinkle: { '0%,100%': { opacity: 0.2 }, '50%': { opacity: 1 } },
      },
    },
  },
  plugins: [],
};
