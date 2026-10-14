/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: v('canvas'),
        card: v('card'),
        soft: v('soft'),
        softer: v('softer'),
        ink: v('ink'),
        muted: v('muted'),
        primary: v('primary'),
        'on-primary': v('on-primary'),
        navy: '#14213D',
        gold: v('gold'),
        'gold-ink': v('gold-ink'),
        'gold-soft': v('gold-soft'),
        line: v('line'),
        danger: v('danger'),
        'danger-soft': v('danger-soft'),
        success: v('success'),
        'bubble-out': v('bubble-out'),
        'bubble-out-ink': v('bubble-out-ink'),
        'bubble-in': v('bubble-in'),
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'label-sm': ['11px', { lineHeight: '16px', letterSpacing: '0.06em', fontWeight: '600' }],
        'label-md': ['13px', { lineHeight: '18px', letterSpacing: '0.02em', fontWeight: '500' }],
      },
      boxShadow: {
        lvl1: '0 2px 8px -2px rgba(20,33,61,0.06), 0 1px 3px 0 rgba(20,33,61,0.03)',
        lvl2: '0 12px 28px -6px rgba(20,33,61,0.12), 0 4px 12px -2px rgba(20,33,61,0.05)',
      },
      keyframes: {
        fadeUp: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        pulseRing: { '0%': { transform: 'scale(1)', opacity: 0.6 }, '100%': { transform: 'scale(1.6)', opacity: 0 } },
        blink: { '0%,80%,100%': { opacity: 0.25 }, '40%': { opacity: 1 } },
        progress: { from: { width: '0%' }, to: { width: '100%' } },
      },
      animation: {
        fadeUp: 'fadeUp .22s ease-out both',
        pulseRing: 'pulseRing 1.6s ease-out infinite',
        blink: 'blink 1.2s infinite',
      },
    },
  },
  plugins: [],
};
