import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Build stamp, surfaced in Settings. The service worker can serve a previous
  // build's index.html on the first launch after a deploy, so without this
  // there is no way to tell which build is on screen.
  define: {
    __BUILD_STAMP__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z'),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: 'Flow State Suspension',
        short_name: 'FlowState',
        description: 'Mountain bike suspension servicing tracker',
        // Matches the black app headers — see the theme-color note in index.html
        theme_color: '#000000',
        // Keep light: black here makes iOS stop reserving space for the status
        // bar and overlay it on the header instead.
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // The public booking page must always come from the network. Serving it
        // from the precached shell means a customer who opens the link once can
        // keep getting an old form — wrong dates, wrong brands — with no way to
        // know. The workshop app itself still works offline.
        navigateFallbackDenylist: [/^\/book/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
              networkTimeoutSeconds: 10
            }
          }
        ]
      },
      devOptions: { enabled: false }
    })
  ]
})
