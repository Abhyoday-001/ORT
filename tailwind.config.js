/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      /* ── Font Families ── */
      fontFamily: {
        display: ['"Orbitron"', '"JetBrains Mono"', 'monospace'],
        ui:      ['"Inter"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },

      /* ── Cyber Color Palette ── */
      colors: {
        // Primary surface
        primary:    { DEFAULT: '#0f172a', light: '#1e293b', dark: '#020617' },
        // Panel glass
        panel:      { DEFAULT: 'rgba(15,23,42,0.6)', solid: '#0f172a' },
        // Neon accents
        neon: {
          cyan:    { DEFAULT: '#06b6d4', light: '#22d3ee', dark: '#0891b2', dim: 'rgba(6,182,212,0.15)' },
          blue:    { DEFAULT: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
          emerald: { DEFAULT: '#10b981', light: '#34d399', dark: '#059669' },
          rose:    { DEFAULT: '#f43f5e', light: '#fb7185', dark: '#e11d48' },
          amber:   { DEFAULT: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
          violet:  { DEFAULT: '#a855f7', light: '#c084fc', dark: '#7c3aed' },
        },
        // Semantic
        'alert-red':      '#ef4444',
        'warning-orange': '#f97316',
        'success-green':  '#22c55e',
        // RCB Theme Colors
        'rcb-red': '#CC0000',
        'rcb-gold': '#FFD700',
        'rcb-white': '#FFFFFF',
        // Legacy compat
        cyber: {
          50: '#e0fbfc', 100: '#c2f0f4', 200: '#76e4ed', 300: '#3ad8e6',
          400: '#00bcd4', 500: '#0097a7', 600: '#00838f', 700: '#006978',
          800: '#004d5a', 900: '#00333d',
        },
      },

      /* ── Spacing Extensions ── */
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '100': '25rem',
      },

      /* ── Border Radius ── */
      borderRadius: {
        'panel': '0.85rem',
      },

      /* ── Box Shadow — Glow System ── */
      boxShadow: {
        'glow-cyan':    '0 0 14px rgba(6,182,212,0.35), 0 0 40px rgba(6,182,212,0.08)',
        'glow-cyan-lg': '0 0 24px rgba(6,182,212,0.5), 0 0 60px rgba(6,182,212,0.12)',
        'glow-emerald': '0 0 14px rgba(16,185,129,0.35), 0 0 40px rgba(16,185,129,0.08)',
        'glow-rose':    '0 0 14px rgba(244,63,94,0.35), 0 0 40px rgba(244,63,94,0.08)',
        'glow-amber':   '0 0 14px rgba(251,191,36,0.3), 0 0 40px rgba(251,191,36,0.06)',
        'glow-violet':  '0 0 14px rgba(168,85,247,0.35), 0 0 40px rgba(168,85,247,0.08)',
        'panel':        '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(100,116,139,0.08)',
        'panel-hover':  '0 8px 32px rgba(0,0,0,0.5), 0 0 28px rgba(6,182,212,0.06)',
        'soft':         '0 4px 20px rgba(0,0,0,0.4)',
        'inner-glow':   'inset 0 0 30px rgba(6,182,212,0.03)',
      },

      /* ── Animations ── */
      animation: {
        'pulse-glow':    'pulseGlow 2.5s ease-in-out infinite',
        'scan-line':     'scanLine 3s linear infinite',
        'fade-in-up':    'fadeInUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
        'neon-flicker':  'neonFlicker 4s linear infinite',
        'border-breathe':'borderBreathe 6s ease-in-out infinite',
        'toast-in':      'toastSlideIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'slide-in-left': 'slideInLeft 0.3s ease-out forwards',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(6,182,212,0.15)' },
          '50%':      { boxShadow: '0 0 22px rgba(6,182,212,0.45), 0 0 50px rgba(6,182,212,0.1)' },
        },
        scanLine: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        neonFlicker: {
          '0%, 19%, 21%, 23%, 25%, 54%, 56%, 100%': { opacity: '1' },
          '20%, 24%, 55%': { opacity: '0.85' },
        },
        borderBreathe: {
          '0%, 100%': { borderColor: 'rgba(6,182,212,0.15)' },
          '50%':      { borderColor: 'rgba(6,182,212,0.3)' },
        },
        toastSlideIn: {
          '0%':   { opacity: '0', transform: 'translate(-50%, -18px) scale(0.92)' },
          '100%': { opacity: '1', transform: 'translate(-50%, 0) scale(1)' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },

      /* ── Backdrop Blur ── */
      backdropBlur: {
        'glass': '18px',
      },

      /* ── Transition Timing ── */
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16,1,0.3,1)',
        'spring':   'cubic-bezier(0.34,1.56,0.64,1)',
      },
    },
  },
  plugins: [],
};
