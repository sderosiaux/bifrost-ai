import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/health': 'http://localhost:5174',
      '/model': 'http://localhost:5174',
      '/chat': 'http://localhost:5174',
    },
  },
});