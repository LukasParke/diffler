import { build } from "esbuild";

// Produces the committed single-file bundle the composite GitHub Action runs
// (packages/diffler/dist-action/index.js). Committing the bundle keeps the
// action hermetic: consumers do not install dependencies or compile TypeScript
// on every run. CI verifies the bundle is fresh with `git diff --exit-code`.
await build({
  entryPoints: ["src/cli.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist-action/index.js",
  // CJS dependencies (commander, nunjucks) call require() for node builtins;
  // provide it in the ESM output. The entry point's own `#!/usr/bin/env node`
  // is preserved by esbuild on line 1.
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  sourcemap: false,
  minify: false,
  metafile: process.env.DIFFLER_BUNDLE_METAFILE !== "",
  external: ["fsevents"],
  alias: {
    // Bundle the shared schemas from source so the action build does not
    // depend on a prior tsc pass of the schemas workspace package.
    "@lukasparke/diffler-schemas": "../schemas/src/index.ts",
  },
});
