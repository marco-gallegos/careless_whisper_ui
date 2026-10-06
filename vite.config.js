/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig(({ mode }) => {
  // Not VITE_-prefixed on purpose: only the dev/preview server needs it, not the browser bundle
  const env = loadEnv(mode, process.cwd(), '')

  // Same-origin path to the local Whisper API. A phone can't reach "localhost", and an
  // https page can't call an http LAN address (mixed content), so the dev server forwards
  // /whisper/* to the service running on this machine.
  const whisperProxy = {
    '/whisper': {
      target: env.WHISPER_PROXY_TARGET || 'http://localhost:8765',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/whisper/, '')
    }
  }

  return {
    // `npm run dev:lan` sets HTTPS=1: mic access (getUserMedia) only exists on secure origins
    plugins: [react(), ...(process.env.HTTPS ? [basicSsl()] : [])],
    server: {
      port: 3000,
      open: true,
      proxy: whisperProxy
    },
    preview: {
      proxy: whisperProxy
    },
    build: {
      rollupOptions: {
        external: ['better-sqlite3', 'mongodb']
      }
    }
  }
})