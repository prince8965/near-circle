/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#00F2FE', // Neon Cyan / Electric Teal
          dark: '#00D4E0',
          deeper: '#00F2FE',
          hover: '#38BDF8',
          purple: '#A855F7', // Neon Purple
          'purple-hover': '#9333EA',
        },
        cyber: {
          cyan: '#00F2FE',
          purple: '#A855F7',
          midnight: '#0B0F19',
          slate: '#1E293B',
          border: '#334155',
          muted: '#94A3B8',
        },
        secondary: {
          DEFAULT: '#1E293B', // Slate Blue structure
          light: '#334155',
          hover: '#334155',
        },
        soft: '#1E293B',
        canvas: '#0B0F19', // Deep Midnight Blue / Charcoal dominant background
        ink: {
          DEFAULT: '#FFFFFF', // Crisp White
          muted: '#94A3B8', // Muted Gray
          faint: '#64748B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(51, 65, 85, 0.6)',
        lift: '0 12px 32px -4px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(0, 242, 254, 0.25)',
        cyber: '0 0 20px -2px rgba(0, 242, 254, 0.35)',
        purple: '0 0 20px -2px rgba(168, 85, 247, 0.35)',
        neon: '0 0 15px rgba(0, 242, 254, 0.45), 0 0 30px rgba(0, 242, 254, 0.2)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}
