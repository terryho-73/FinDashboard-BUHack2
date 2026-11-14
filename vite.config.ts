import path from 'node:path'
import { defineConfig } from 'vite-plus'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import vibes from '@omg-dev/vite-plugin'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { localApiPlugin } from './server/vite-local-api-plugin'

const isNodeRuntime = process.env.NODE_RUNTIME === 'node'

export default defineConfig({
  plugins: [
    // Must come before react(): it generates src/routeTree.gen.ts from
    // src/routes/ and code-splits each route into its own chunk.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    // Node dev (npm run dev): SQLite-backed /api/* — no Bun required.
    // Non-node hosts can still use the full @omg-dev vite plugin.
    ...(isNodeRuntime ? [localApiPlugin()] : [vibes()]),
  ],
  resolve: {
    // pi (and humans copying from shadcn docs) reaches for '@/components/...'
    // unconditionally. Bake the alias here so the import resolves in every
    // new project without each one having to configure it.
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    cors: true,
    hmr: {
      overlay: false,
    },
  },
})
