import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@erp/logger': resolve(__dirname, '../../packages/logger/src'),
      '@erp/errors': resolve(__dirname, '../../packages/errors/src'),
      '@erp/types': resolve(__dirname, '../../packages/types/src'),
      '@erp/config': resolve(__dirname, '../../packages/config/src'),
      '@erp/database': resolve(__dirname, '../../packages/database/src'),
    },
  },
  server: {
    port: 3001,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
