import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Served from the root of the custom domain (meow-ney.sillycookie.me), not from
  // /Meow-ney-Maker/. If the custom domain is ever dropped and the site falls back
  // to xinyeeelaine.github.io/Meow-ney-Maker/, this must become '/Meow-ney-Maker/'.
  base: '/',
  plugins: [react()],
})
