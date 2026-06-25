/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          'sans-serif',
        ],
      },
      colors: {
        apple: {
          bg: '#f5f5f7',
          text: '#1d1d1f',
          muted: 'rgba(29,29,31,0.55)',
          blue: '#0071e3',
          green: '#34c759',
          orange: '#ff9f0a',
          red: '#ff3b30',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
        'glass-lg': '0 12px 40px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.85)',
        glow: '0 0 40px rgba(0,113,227,0.15)',
        'peer-selected': '0 0 0 2px #0071e3, 0 12px 32px rgba(0,113,227,0.18)',
        'send-btn': '0 4px 16px rgba(0,113,227,0.35)',
        'send-btn-hover': '0 8px 24px rgba(0,113,227,0.4)',
      },
      width: {
        radar: 'min(82vw, 380px)',
        sheet: 'min(92vw, 420px)',
        toast: 'min(92vw, 380px)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.25,0.1,0.25,1) both',
        'fade-up-delayed': 'fadeUp 0.6s cubic-bezier(0.25,0.1,0.25,1) 0.1s both',
        'fade-up-controls': 'fadeUp 0.6s cubic-bezier(0.25,0.1,0.25,1) 0.2s both',
        'fade-in-delayed': 'fadeIn 1s ease 0.8s both',
        'fade-in': 'fadeIn 1s ease both',
        'sheet-up': 'sheetUp 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        'toast-in': 'toastIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
        breathe: 'breathe 4s ease-in-out infinite',
        ripple: 'ripple 4s ease-out infinite',
        'ripple-delay-1': 'ripple 4s ease-out 1.3s infinite',
        'ripple-delay-2': 'ripple 4s ease-out 2.6s infinite',
        'drift-delay-1': 'drift 18s ease-in-out -6s infinite alternate',
        'drift-delay-2': 'drift 18s ease-in-out -12s infinite alternate',
        drift: 'drift 18s ease-in-out infinite alternate',
        'pulse-dot': 'pulseDot 1.2s ease infinite',
        spin: 'spin 1.2s linear infinite',
        pop: 'pop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        float: 'float 3s ease-in-out infinite',
        'drop-in': 'dropIn 0.55s cubic-bezier(0.34,1.56,0.64,1) both',
        'peer-pulse': 'peerPulse 2s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2.4s ease-in-out infinite',
        'spin-slow': 'spin 10s linear infinite',
        'drop-ring-out': 'dropRingOut 2.8s ease-out infinite',
        'drop-ring-out-delay-1': 'dropRingOut 2.8s ease-out 0.9s infinite',
        'drop-ring-out-delay-2': 'dropRingOut 2.8s ease-out 1.8s infinite',
        'frame-glow': 'frameGlow 2.4s ease-in-out infinite',
        'tagline-in': 'taglineIn 0.45s cubic-bezier(0.25,0.1,0.25,1) both',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        sheetUp: {
          '0%': { opacity: '0', transform: 'translateX(-50%) translateY(24px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateX(-50%) translateY(0) scale(1)' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateY(-8px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        ripple: {
          '0%': { opacity: '0.5', transform: 'scale(0.95)' },
          '100%': { opacity: '0', transform: 'scale(1.08)' },
        },
        drift: {
          from: { transform: 'translate(0,0)' },
          to: { transform: 'translate(24px,-18px)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        pop: {
          '0%': { transform: 'scale(0.8)' },
          '60%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        dropIn: {
          '0%': { opacity: '0', transform: 'scale(0.6) translateY(16px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        peerPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0,113,227,0.35)' },
          '50%': { boxShadow: '0 0 0 8px rgba(0,113,227,0)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.03)' },
        },
        dropRingOut: {
          '0%': { opacity: '0.65', transform: 'scale(0.92)' },
          '100%': { opacity: '0', transform: 'scale(1.55)' },
        },
        frameGlow: {
          '0%, 100%': {
            opacity: '0.45',
            boxShadow: 'inset 0 0 0 2px rgba(0,113,227,0.15), 0 0 40px rgba(0,113,227,0.08)',
          },
          '50%': {
            opacity: '1',
            boxShadow: 'inset 0 0 0 2px rgba(0,113,227,0.35), 0 0 60px rgba(0,113,227,0.18)',
          },
        },
        taglineIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
