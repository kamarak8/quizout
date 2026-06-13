/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Keep pitch-dark for button text contrast
        pitch: {
          DEFAULT: '#0d0d0d',
          dark: '#0d0d0d',
          light: '#161616',
        },
        surface: '#161616',
        border: 'rgba(255,255,255,0.08)',
        accent: '#f59e0b',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'slide-up':   'slideUp 0.35s ease-out forwards',
        'bounce-in':  'bounceIn 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'fade-in':    'fadeIn 0.3s ease-out forwards',
        'pulse-ring': 'pulseRing 1.5s ease-out infinite',
        'shake':      'shake 0.4s ease-out forwards',
      },
      keyframes: {
        slideUp:   { '0%': { transform: 'translateY(16px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        bounceIn:  { '0%': { transform: 'scale(0.4)', opacity: '0' }, '70%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        pulseRing: { '0%': { transform: 'scale(1)', opacity: '0.8' }, '100%': { transform: 'scale(1.5)', opacity: '0' } },
        shake:     { '0%,100%': { transform: 'translateX(0)' }, '25%': { transform: 'translateX(-8px)' }, '75%': { transform: 'translateX(8px)' } },
      },
    },
  },
  plugins: [],
}
