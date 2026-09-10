import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadConfig } from "../dist/config.js";
import { Engine } from "../dist/core/engine.js";
import { Renderer } from "../dist/core/renderer.js";

const EXAMPLE_TEMPLATE = fileURLToPath(new URL("../examples/readme-example.md.j2", import.meta.url));

async function main() {
  const { values } = parseArgs({
    options: {
      config: { type: "string", short: "c" },
      readme: { type: "string", default: "README.md" },
    },
  });
  const readmePath = resolve(values.readme);
  if (!existsSync(readmePath)) {
    console.log("No README file found; skipping.");
    return;
  }
  const readme = readFileSync(readmePath, "utf-8");
  const startMarker = "<!-- DIFFLER_EXAMPLE_START -->";
  const endMarker = "<!-- DIFFLER_EXAMPLE_END -->";
  const startIdx = readme.indexOf(startMarker);
  const endIdx = readme.indexOf(endMarker);
  if (startIdx === -1 || endIdx <= startIdx) {
    console.log("Ordered example markers not found in README; skipping.");
    return;
  }

  const loaded = loadConfig(values.config);
  const config = {
    ...loaded,
    templates: {
      ...loaded.templates,
      main: basename(EXAMPLE_TEMPLATE),
      directory: dirname(EXAMPLE_TEMPLATE),
    },
  };
  const engine = new Engine(config, new Renderer(config));
  const rendered = await engine.render();
  const before = readme.slice(0, startIdx + startMarker.length);
  const after = readme.slice(endIdx);
  writeFileSync(readmePath, `${before}\n${rendered.trim()}\n${after}`, "utf-8");
  console.log("README example updated.");
}

main().catch(() => {
  console.error("Failed to update the README example. Check the config, template, and GitHub collection credentials.");
  process.exitCode = 1;
});
