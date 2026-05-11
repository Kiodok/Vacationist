/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../apps/mobile/app/**/*.{ts,tsx}',
    '../../apps/mobile/src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#0F0F0F',
        surface: {
          DEFAULT: '#1A1A1A',
          elevated: '#242424',
        },
        border: '#2E2E2E',
        primary: {
          DEFAULT: '#6C63FF',
          light: '#8A84FF',
          muted: 'rgba(108, 99, 255, 0.1)',
        },
        success: '#3ECF8E',
        warning: '#F5A623',
        danger: '#FF5C5C',
        'text-primary': '#F2F2F2',
        'text-secondary': '#A0A0A0',
        'text-muted': '#5C5C5C',
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
