import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    legacy({
      targets: ['safari >= 13', 'ios >= 13', 'defaults']
    }),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true // Allows testing PWA in dev mode
      },
      manifest: {
        name: 'Meza Cafe POS',
        short_name: 'Meza POS',
        description: 'Offline-First Cashier POS',
        theme_color: '#f97316',
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png', // Placeholder coffee icon
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'unsplash-images',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 Days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
})
