// frontend/vite.config.ts   (or .js)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url'; 

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),   // Tailwind plugin
    react(),         // React plugin
  ],

  /* ---------- path alias so "@/foo" === "<root>/src/foo" ---------- */
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  /* ---------- local dev proxy to Fastify backend ------------------ */
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
