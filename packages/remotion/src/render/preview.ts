import type {RenderFormat} from './config';

export function buildIndexHtml(
	compositionIds: string[],
	formats: RenderFormat[],
): string {
	const images = compositionIds
		.map((id) => {
			const assets = formats
				.map(
					(format) => `<img src="./${id}.${format}" alt="${id} ${format}" />`,
				)
				.join('');
			return `<section><h2>${id}</h2>${assets}</section>`;
		})
		.join('\n');

	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GitHub Stats Remotion Assets</title>
  <style>
    body { margin: 0; padding: 24px; background: #0d1117; color: #f0f3f6; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    main { display: grid; gap: 24px; max-width: 900px; margin: 0 auto; }
    section { display: grid; gap: 8px; }
    h1, h2 { margin: 0; }
    h2 { color: #8b949e; font-size: 14px; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <main>
    <h1>GitHub Stats Remotion Assets</h1>
    ${images}
  </main>
</body>
</html>
`;
}
