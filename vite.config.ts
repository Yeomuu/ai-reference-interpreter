import { defineConfig } from 'vitest/config'

export default defineConfig({
  build: { rollupOptions: { output: { manualChunks: { 'react-vendor': ['react', 'react-dom', 'react-dom/client'] } } } },
  test: {
    environment: 'node',
  },
})
