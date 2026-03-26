import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('leaflet') || id.includes('react-leaflet')) {
            return 'map-vendor'
          }

          if (id.includes('firebase/auth')) {
            return 'firebase-auth'
          }

          if (id.includes('firebase/firestore')) {
            return 'firebase-firestore'
          }

          if (id.includes('firebase/storage')) {
            return 'firebase-storage'
          }

          if (id.includes('firebase')) {
            return 'firebase-core'
          }

          if (id.includes('react-router')) {
            return 'router-vendor'
          }

          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('scheduler')) {
            return 'react-vendor'
          }

          return 'vendor'
        }
      }
    }
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts']
  }
})
