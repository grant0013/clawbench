import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Electron can't load type="module" scripts with crossorigin on file:// URLs
const removeElectronCrossorigin = {
  name: 'remove-crossorigin',
  transformIndexHtml(html: string) {
    return html.replace(/ crossorigin/g, '')
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), removeElectronCrossorigin],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
  },
})
