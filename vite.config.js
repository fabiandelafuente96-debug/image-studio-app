import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/image-studio-app/', // <-- Maps assets to your GitHub Pages repo path
  server: {
    port: 5173,
    open: true
  }
});