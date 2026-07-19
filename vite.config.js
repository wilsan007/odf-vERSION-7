import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/odf-vERSION-7/' : '/',
  plugins: [react()],
  server: {
    port: 6001,
    strictPort: true,
  },
  preview: {
    port: 6001,
    strictPort: true,
  },
})
