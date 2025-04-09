import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(), // Ensure tailwindcss() is called if it's a function plugin
    react()
  ],
  server: {
    proxy: {
      // Proxy API requests to your Fastify backend server
      '/api': {
        target: 'http://localhost:3000', // backend server address
        changeOrigin: true, // Recommended for virtual hosted sites (and generally safe to include)
      }
    }
  }
})