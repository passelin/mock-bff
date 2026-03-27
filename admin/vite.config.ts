import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  base: '/-/admin/',
  plugins: [react()],
  root: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          vendor: ['lucide-react'],
          'swagger-ui': ['swagger-ui-react'],
        },
      },
    },
  },
});
