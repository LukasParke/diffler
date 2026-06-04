import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../dist/config.js";
import { Engine } from "../dist/core/engine.js";
import { Renderer } from "../dist/core/renderer.js";

const README_PATH = resolve("README.md");
const EXAMPLE_TEMPLATE = resolve("examples/readme-example.md.j2");

async function main() {
  if (!existsSync(EXAMPLE_TEMPLATE)) {
    console.log("No example template found; skipping.");
    return;
  }

  const config = loadConfig();
  const renderer = new Renderer(config);
  const engine = new Engine(config, renderer);
  const rendered = await engine.render();

  if (!existsSync(README_PATH)) {
    console.log("No README.md found; skipping.");
    return;
  }

  let readme = readFileSync(README_PATH, "utf-8");
  const startMarker = "<!-- DIFFLER_EXAMPLE_START -->";
  const endMarker = "<!-- DIFFLER_EXAMPLE_END -->";

  const startIdx = readme.indexOf(startMarker);
  const endIdx = readme.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    console.log("Markers not found in README.md; skipping.");
    return;
  }

  const before = readme.slice(0, startIdx + startMarker.length);
  const after = readme.slice(endIdx);
  const updated = `${before}\n${rendered}\n${after}`;

  writeFileSync(README_PATH, updated, "utf-8");
  console.log("README example updated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
