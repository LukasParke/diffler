export function details(summary: string, content: string): string {
  return `<details><summary>${summary}</summary>\n\n${content}\n\n</details>`;
}

export function center(content: string): string {
  return `<div align="center">\n\n${content}\n\n</div>`;
}

export function columns(items: string[], count = 2): string {
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += count) {
    const row = items.slice(i, i + count).join(" | ");
    rows.push(row);
  }
  return rows.join("\n\n");
}
