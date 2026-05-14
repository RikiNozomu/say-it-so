import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/say-it-so/',
  plugins: [react()],
  resolve: {
    alias: {
      '@say-it-so/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
})
