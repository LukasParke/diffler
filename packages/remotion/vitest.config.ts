import {resolve} from 'node:path';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Resolve the shared schemas from source so `pnpm test` works without a
      // prior build of the schemas workspace package.
      '@lukasparke/diffler-schemas': resolve(
        import.meta.dirname,
        '../schemas/src/index.ts',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
