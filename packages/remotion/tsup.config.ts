import {defineConfig} from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/cards/index.ts',
    'src/themes/index.ts',
    'src/render/index.ts',
    'src/render/cli.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['remotion', 'react', 'react-dom', 'zod'],
  target: 'es2020',
});
