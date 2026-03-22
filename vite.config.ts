import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  server: {
    proxy: {
      /** Circle Modular JSON-RPC is proxied by Express POST /api/circle-modular (Vite POST→HTML quirk). */
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/openapi.json': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  /** Same proxy for `vite preview` so production build + API works locally. */
  preview: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/openapi.json': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
