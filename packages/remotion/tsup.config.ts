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
  // Share ThemeContext between root, /themes and /cards in BOTH module formats.
  // Independent entry bundles create providers that cannot reach card consumers.
  splitting: true,
  sourcemap: true,
  clean: true,
  external: [
    '@lukasparke/diffler-schemas',
    '@remotion/bundler',
    '@remotion/renderer',
    'remotion',
    'react',
    'react-dom',
    'zod',
  ],
  target: 'es2022',
});
