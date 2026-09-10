import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {basename, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

// Resolve everything from this file, not the caller's working directory.
const packageDir = fileURLToPath(new URL('../', import.meta.url));
const distDir = join(packageDir, 'dist');
const require = createRequire(import.meta.url);
const fontDir = dirname(require.resolve('@fontsource/fira-code/package.json'));
const fonts = new Set();
const fontCss = [];

await mkdir(join(distDir, 'fonts'), {recursive: true});
for (const weight of [400, 500, 600, 700]) {
  const css = postcss.parse(await readFile(join(fontDir, `${weight}.css`), 'utf8'));
  // Keep Fontsource's unicode ranges, but only ship the WOFF2 files Chromium uses.
  css.walkDecls('src', (declaration) => {
    const urls = [...declaration.value.matchAll(/url\((['"]?)(\.\/files\/[^'"()]+\.woff2)\1\)/g)];
    if (urls.length === 0) {
      throw new Error(`No WOFF2 source for Fira Code ${weight}`);
    }
    declaration.value = urls.map(([, , path]) => {
      const file = basename(path);
      fonts.add(file);
      return `url('./fonts/${file}') format('woff2')`;
    }).join(', ');
  });
  fontCss.push(css.toString());
}
for (const file of fonts) {
  await copyFile(join(fontDir, 'files', file), join(distDir, 'fonts', file));
}
await copyFile(join(fontDir, 'LICENSE'), join(distDir, 'fonts', 'LICENSE.txt'));

const sourcePath = join(packageDir, 'src', 'style.css');
const outputPath = join(distDir, 'styles.css');
const source = await readFile(sourcePath, 'utf8');
// Some cards use scoped inline layouts. Still compile any library utility classes
// even when the base stylesheet no longer contains Tailwind directives.
const input = source.includes('@tailwind utilities') ? source : `${source}\n@tailwind utilities;`;
const result = await postcss([
  tailwindcss({
    // Published consumers do not scan node_modules or need a Tailwind plugin.
    content: [join(packageDir, 'src', '**', '*.{ts,tsx}')],
    theme: {extend: {fontFamily: {mono: ["'Fira Code'", 'monospace']}}},
    plugins: [],
  }),
]).process(input, {from: sourcePath, to: outputPath, map: false});

await writeFile(outputPath, `${fontCss.join('\n')}\n${result.css}\n`);
await writeFile(join(distDir, 'styles.d.ts'), 'export {};\n');
console.log(`Built styles.css with ${fonts.size} local Fira Code WOFF2 assets (OFL-1.1).`);
