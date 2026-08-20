# Diffler Roadmap

Diffler's primary interface is its GitHub Action. It hides stats collection,
template rendering, caching, and repository updates behind one workflow step.
The CLI and Remotion packages remain available for local use and custom
rendering.

## v1 readiness

- [x] One stats collection engine and shared schema package
- [x] Reproducible pnpm installs and pull-request verification
- [x] Scoped, independently publishable npm packages
- [x] GitHub Pages asset deployment
- [x] Packed CLI smoke test
- [x] Canonical v2 output schema (no legacy aliases), shared merge, and a
      schema-validated renderer adapter
- [x] Hermetic GitHub Action (committed bundle, git identity configured)
- [x] Template data-source helpers render prefetched data synchronously
- [ ] Publish the first npm release from a version tag
- [ ] Move the `v1` tag after the release workflow succeeds
- [ ] Migrate `LukasParke/LukasParke` from readme-scribe to Diffler
- [ ] Replace Remotion's legacy ESLint preset, which requires undeclared plugins

## Next

- Add a PyPI package-stats adapter using the normalized package metrics seam.
- Add a consumer fixture that exercises the released GitHub Action end to end
  (the render smoke test already runs from a committed fixture).
- Measure and reduce stats collection and animation render time; templates now
  opt out of traffic/contributor backfill they do not reference.
- Add image-link validation to the profile repository.
