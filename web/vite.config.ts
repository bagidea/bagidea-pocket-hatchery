import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  // Production base = plugin static folder. No content hashes in filenames
  // because the daemon's static-file listing caches filenames at plugin load;
  // new hash values would 404 until the daemon restarts.
  base: '/plugin/pocket-hatchery/static/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (info) => {
          if (info.name && /\.(woff2?|ttf|eot)$/.test(info.name))
            return 'assets/[name].[ext]'
          return 'assets/[name].[ext]'
        },
      },
    },
  },
  plugins: [react(), nodePolyfills({ include: ['buffer', 'crypto', 'stream', 'util', 'process'] })],
  server: {
    port: 5173,
    // Expose on the LAN so the game can be opened from a phone during demos.
    host: true,
    // Same-origin bridge to the office daemon (:8787). The "Connect via waxwing"
    // path drives the daemon wallet (sign game actions, read account/balance)
    // from the browser — but the daemon has NO CORS headers and does not answer
    // an OPTIONS preflight, so a cross-origin fetch from :5173 → :8787 is blocked.
    // Routing through `/office/*` keeps every call same-origin (browser only ever
    // talks to :5173), which sidesteps CORS entirely with zero daemon changes.
    // (Internal dev tool only — the proxy is a Vite dev feature, not in the prod build.)
    proxy: {
      '/office': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/office/, ''),
      },
    },
  },
})
