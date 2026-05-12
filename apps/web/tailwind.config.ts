import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#1a1a2e',
        panel: '#16213e',
        border: '#0f3460',
        accent: '#e94560',
      },
    },
  },
  plugins: [],
} satisfies Config
