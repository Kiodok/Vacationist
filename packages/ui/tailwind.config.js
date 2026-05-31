/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
    '../../apps/mobile/app/**/*.{ts,tsx}',
    '../../apps/mobile/src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Theme-aware colors via CSS variables (light/dark swap automatically)
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          elevated: 'rgb(var(--color-surface-elevated) / <alpha-value>)',
        },
        border: 'rgb(var(--color-border) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
        // Brand/status colors — same in both themes
        primary: {
          DEFAULT: '#6C63FF',
          light: '#8A84FF',
          muted: 'rgba(108, 99, 255, 0.1)',
        },
        success: {
          DEFAULT: '#3ECF8E',
          muted: 'rgba(62, 207, 142, 0.1)',
        },
        warning: {
          DEFAULT: '#F5A623',
          muted: 'rgba(245, 166, 35, 0.1)',
        },
        danger: '#FF5C5C',
        // Accent colors — theme-invariant
        teal: {
          DEFAULT: '#14B8A6',
          muted: 'rgba(20, 184, 166, 0.1)',
        },
        pink: {
          DEFAULT: '#EC4899',
          muted: 'rgba(236, 72, 153, 0.1)',
        },
        amber: {
          DEFAULT: '#F59E0B',
          muted: 'rgba(245, 158, 11, 0.1)',
        },
        sky: {
          DEFAULT: '#0EA5E9',
          muted: 'rgba(14, 165, 233, 0.1)',
        },
        emerald: {
          DEFAULT: '#10B981',
          muted: 'rgba(16, 185, 129, 0.1)',
        },
        rose: {
          DEFAULT: '#F43F5E',
          muted: 'rgba(244, 63, 94, 0.1)',
        },
        indigo: {
          DEFAULT: '#6366F1',
          muted: 'rgba(99, 102, 241, 0.1)',
        },
        orange: {
          DEFAULT: '#F97316',
          muted: 'rgba(249, 115, 22, 0.1)',
        },
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
        '3xl': '64px',
      },
      borderRadius: {
        sm: '6px',
        md: '12px',
        lg: '20px',
        full: '9999px',
      },
      fontSize: {
        'heading-xl': ['28px', { fontWeight: '700', lineHeight: '34px' }],
        'heading-l': ['22px', { fontWeight: '600', lineHeight: '28px' }],
        'heading-m': ['18px', { fontWeight: '600', lineHeight: '24px' }],
        body: ['15px', { fontWeight: '400', lineHeight: '22px' }],
        'body-small': ['13px', { fontWeight: '400', lineHeight: '18px' }],
        label: ['12px', { fontWeight: '500', lineHeight: '16px', letterSpacing: '0.05em' }],
      },
    },
  },
  plugins: [],
};
