import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  envPrefix: ['VITE_'],
  server: {
    host: true,
    port: 5176,
    // Note: No COOP/COEP headers needed here — Chrome grants SharedArrayBuffer
    // on localhost automatically. These headers are set in vercel.json for production.
  },
})
