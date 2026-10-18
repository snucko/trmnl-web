import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    tailwindcss(),
  ],
  build: {
    // Fire tablets and other wall-mounted Android devices often run an old
    // System WebView that can't parse modern syntax (?., ??=) and would show a
    // blank page, so lower the syntax for them.
    target: ['chrome64', 'safari12'],
    cssTarget: ['chrome64', 'safari12'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
