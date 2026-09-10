# Remotion package consumer

This workspace consumes **`@lukasparke/diffler-remotion`**. `github-readme-cards` is the installed render binary's name.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter '@lukasparke/diffler-remotion...' build
pnpm --filter remotion-usage-example typecheck
pnpm --filter remotion-usage-example start
```

`start` and `render` run with **this directory as their CWD**. The checked-in `input.json` is an example live public stats URL; replace it with your own source before relying on its contents. To use a local collection without browser filesystem access, export inline data from the root:

```sh
# Requires your configured GitHub identity and a securely supplied GITHUB_TOKEN.
pnpm diffler export-remotion --config .github/diffler.yml \
  --output examples/remotion-usage/input.json
pnpm --filter remotion-usage-example render
```

The default render writes WebP/GIF files into this example's ignored `pages/`. FFmpeg with libwebp is required for those animation formats. For a short PNG check, from **this directory**:

```sh
pnpm exec github-readme-cards --entry-point src/index.tsx \
  --props input.json --cards stats --formats png --still-frame 60 --out-dir pages
```

The example uses one exported `cards` registry for components and dimensions. It imports `@lukasparke/diffler-remotion/styles.css` once, including built styles and local licensed Fira Code fonts. Its theme provider comes from `/themes` while cards come from `/cards`, exercising real cross-entry usage without consumer Tailwind configuration.

Pinned peers are React/React DOM 18.3.1, Remotion 4.0.509, and Zod 4.4.3. When copying this example outside the workspace, replace `workspace:*` with the published `@lukasparke/diffler-remotion` version you are consuming.

For a deterministic test that does not fetch live stats, run root `pnpm smoke:render`. It installs package tarballs into a temporary external consumer, copies this example unchanged, supplies a fixed fixture and data-URI avatar, and saves evidence to `artifacts/consumer-smoke/`.
