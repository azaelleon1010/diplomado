import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    // Prefer TypeScript sources when both source and generated JavaScript are present.
    extensions: ['.ts', '.tsx', '.mts', '.js', '.mjs', '.cjs', '.json'],
    alias: {
      '@erp/logger': path.resolve(__dirname, 'packages/logger/src'),
      '@erp/errors': path.resolve(__dirname, 'packages/errors/src'),
      '@erp/types': path.resolve(__dirname, 'packages/types/src'),
      '@erp/config': path.resolve(__dirname, 'packages/config/src'),
      '@erp/database': path.resolve(__dirname, 'packages/database/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    include: ['tests/**/*.{test,spec}.ts', 'apps/**/*.{test,spec}.ts', 'packages/**/*.{test,spec}.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'], exclude: ['**/node_modules/**', 'tests/**'] },
    testTimeout: 15000,
    hookTimeout: 15000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
