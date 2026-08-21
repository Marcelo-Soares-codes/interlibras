import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "brand/apple-touch-icon-180x180.png"],
      manifest: {
        id: "/",
        name: "InterLibras — Reconhecimento de Libras",
        short_name: "InterLibras",
        description: "Reconhecimento de letras estáticas em Libras diretamente no dispositivo.",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#18002f",
        theme_color: "#31005d",
        categories: ["education", "utilities"],
        icons: [
          { src: "brand/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "brand/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "brand/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,ico,png}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin
              && (url.pathname.startsWith("/models/") || url.pathname.startsWith("/mediapipe/")),
            handler: "CacheFirst",
            options: {
              cacheName: "interlibras-recognition-v1",
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "interlibras-fonts-v1",
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
