import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages project site lives at /Meow-ney-Maker/, not the domain root.
  // Wrong value here = every asset 404s on deploy while localhost looks fine.
  base: '/Meow-ney-Maker/',
  plugins: [react()],
})
