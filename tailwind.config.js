/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        pitch: {
          DEFAULT: '#0a4f2e',
          dark: '#072b19',
          light: '#0d6b3e',
        },
        grass: '#1a7a46',
        net: '#f0f4f0',
        turf: '#14532d',
        amber: {
          ball: '#f59e0b',
        },
        chalk: '#e8f5e9',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'ball-fly': 'ballFly 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        'net-ripple': 'netRipple 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'bounce-in': 'bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'shake': 'shake 0.4s ease-out forwards',
        'pulse-ring': 'pulseRing 1.5s ease-out infinite',
      },
      keyframes: {
        ballFly: {
          '0%': { transform: 'scale(1) translateY(0)', opacity: '1' },
          '50%': { transform: 'scale(0.7) translateY(-40px)', opacity: '0.9' },
          '100%': { transform: 'scale(0.5) translateY(-80px)', opacity: '0' },
        },
        netRipple: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-8px)' },
          '75%': { transform: 'translateX(8px)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(1)', opacity: '0.8' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
