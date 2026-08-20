import {resolve} from 'node:path';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Resolve the shared schemas from source so `pnpm test` works without a
      // prior build of the schemas workspace package. Vitest runs with the
      // package root as cwd (kept import.meta-free for the commonjs tsconfig).
      '@lukasparke/diffler-schemas': resolve(process.cwd(), '../schemas/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
