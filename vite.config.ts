import path from 'node:path'
import { defineConfig } from 'vite-plus'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import vibes from '@omg-dev/vite-plugin'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { localDbPlugin } from './server/local-db'
import { aiParsePlugin } from './server/ai-parse'

const isNodeRuntime = process.env.NODE_RUNTIME === 'node'
// The vibes plugin needs Bun, so under Node the app has no /api backend unless
// the local SQLite plugin serves it. Default it on for Node; opt out with
// VIBES_LOCAL_DB=false.
const useLocalDb =
  process.env.VIBES_LOCAL_DB === 'true' || (isNodeRuntime && process.env.VIBES_LOCAL_DB !== 'false')

export default defineConfig({
  plugins: [
    // Must come before react(): it generates src/routeTree.gen.ts from
    // src/routes/ and code-splits each route into its own chunk.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    // Node fallback (`dev:sqlite`): serve /api from local SQLite.
    ...(useLocalDb ? [localDbPlugin(process.env.VIBES_DB ?? '.vibes/data.db')] : []),
    // Bun (`dev`): the vibes plugin with local auth.
    ...(isNodeRuntime ? [] : [vibes({ auth: 'local' })]),
    // POST /ai/parse-expense for quick-log. Reads keys from .env / .env.local
    // on every request (server-side only, never bundled into the client).
    aiParsePlugin(() => ({ ...loadEnv('development', process.cwd(), ''), ...process.env })),
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
