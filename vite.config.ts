import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PWA désactivée temporairement (vite-plugin-pwa bug workbox-build en ESM).
// L'install "Ajouter à l'écran d'accueil" sur iPad/iPhone marche quand même
// grâce aux meta apple-mobile-web-app-* dans index.html.

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
})
