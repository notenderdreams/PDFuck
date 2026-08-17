import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['pdfjs-dist', 'pdf-lib', 'canvas-confetti', 'lucide-react', '@tauri-apps/api'],
  },
  server: {
    port: 5173,
    strictPort: true,
    host: 'localhost',
  },
  clearScreen: false,
});
