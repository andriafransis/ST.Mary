import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'منظومة الكنيسة الإلكترونية',
        short_name: 'الكنيسة',
        description: 'منظومة إدارة الكنيسة والخدمات والاعترافات',
        theme_color: '#7a1c24',
        background_color: '#f6f4ef',
        display: 'standalone',
        dir: 'rtl',
        lang: 'ar',
        start_url: './',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});