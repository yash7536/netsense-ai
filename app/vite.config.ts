import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Honor an externally-assigned port (e.g. a dev-server harness picking a
    // free port) instead of Vite's own "try 5173, then increment" fallback,
    // which can otherwise land the dev server on a different port than
    // whatever is proxying/opening it.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: Boolean(process.env.PORT),
  },
})
