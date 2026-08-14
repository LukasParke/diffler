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
- [ ] Publish the first npm release from a version tag
- [ ] Move the `v1` tag after the release workflow succeeds
- [ ] Migrate `LukasParke/LukasParke` from readme-scribe to Diffler
- [ ] Replace Remotion's legacy ESLint preset, which requires undeclared plugins

## Next

- Add a consumer fixture that exercises the released GitHub Action.
- Consolidate the three Remotion export commands.
- Add image-link validation to the profile repository.
- Measure and reduce stats collection and animation render time.
