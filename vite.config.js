import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/ST.Mary/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-32x32.png'],
      manifest: {
        id: '/ST.Mary/',
        scope: '/ST.Mary/',
        start_url: '/ST.Mary/',
        name: 'منظومة الكنيسة الإلكترونية - السيدة العذراء',
        short_name: 'السيدة العذراء',
        description: 'منظومة إدارة الكنيسة والخدمات والاعترافات',
        theme_color: '#7a1c24',
        background_color: '#f6f4ef',
        display: 'standalone',
        dir: 'rtl',
        lang: 'ar',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});