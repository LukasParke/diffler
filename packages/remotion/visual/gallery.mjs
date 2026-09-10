// @ts-check
/** @typedef {import('zod').infer<typeof import('./contracts.mjs').probeReportSchema>} ProbeReport */
/** @typedef {{cardId: string, scenarioId: string, frame: number, width: number, height: number, image: string | null, sha256: string | null, bytes: number, elapsedMs: number, report: ProbeReport | null, error: string | null}} CaseResult */

/** @param {string} text */
export function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/** @param {CaseResult} result */
export function caseFailed(result) {
  return result.error !== null || result.report === null || result.report.issues.length > 0;
}

/** @param {{results: CaseResult[], sheets: string[], fixtureTime: string, theme: string, apiError: string | null}} options */
export function galleryHtml({results, sheets, fixtureTime, theme, apiError}) {
  const failures = results.filter(caseFailed);
  const cardIds = [...new Set(results.map((result) => result.cardId))];
  const panels = cardIds.map((cardId, index) => {
    const cases = results.filter((result) => result.cardId === cardId);
    return `<details ${index === 0 || cases.some(caseFailed) ? 'open' : ''}><summary>${escapeHtml(cardId)} · ${cases.length} frames · ${cases.filter(caseFailed).length} failed</summary><div class="grid">${cases.map((result) => {
      const label = `${result.scenarioId} / ${result.cardId} / f${result.frame}`;
      const issues = result.error ? [result.error] : result.report?.issues ?? ['No probe attestation'];
      return `<figure class="${caseFailed(result) ? 'failed' : 'passed'}"><figcaption>${escapeHtml(label)}<small>${result.width}×${result.height} · ${(result.bytes / 1024).toFixed(1)} KiB · ${result.report?.textNodesChecked ?? 0} text nodes · ${result.report?.intentionalTruncations.length ?? 0} intentional ellipses</small></figcaption>${result.image ? `<a href="${escapeHtml(result.image)}"><img src="${escapeHtml(result.image)}" width="${result.width}" height="${result.height}" loading="lazy" alt="${escapeHtml(label)}"></a>` : '<p>No PNG produced.</p>'}${issues.length ? `<pre>${escapeHtml(issues.join('\n'))}</pre>` : ''}</figure>`;
    }).join('')}</div></details>`;
  }).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Diffler visual review</title>
<style>
*{box-sizing:border-box}body{font:14px/1.5 system-ui,sans-serif;margin:24px;background:#f6f8fa;color:#1f2328}h1{font-size:24px}a{color:#0969da}small{display:block;color:#57606a}summary{cursor:pointer;font-weight:600;padding:12px 0}details{border-top:1px solid #d0d7de}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px}figure{margin:0;padding:12px;border:1px solid #d0d7de;border-radius:8px;min-width:0}figcaption{margin-bottom:12px}figure>a{display:block;background:#0d1117;padding:8px}img{display:block;max-width:100%;height:auto}.failed{border-color:#cf222e}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}#light:checked~.previews figure>a{background:#fff}#narrow:checked~.previews img{max-width:min(360px,100%)}label{margin-right:24px}nav a{margin-right:16px}code{overflow-wrap:anywhere}
</style></head><body>
<h1>Diffler rendered review · ${escapeHtml(theme)}</h1>
<p><strong>${results.length - failures.length}/${results.length} frame checks passed.</strong> Public renderCards PNG parity: ${apiError ? `FAIL — ${escapeHtml(apiError)}` : 'passed'}.</p>
<p>Fixed synthetic data: <code>${escapeHtml(fixtureTime)}</code>. Public registry and packaged local Fira Code; no remote avatars or resources. This is a source render, not recovered historical media.</p>
<p>DOM checks cover foreground text, meaningful graphics and rectangular clipping, including transparent intro rows. Explicit horizontal ellipsis requires a full title/accessible value. They do not prove visual beauty, contrast, overlap, curved masks, glyph raster quality or encoded GIF/WebP quality. PNGs still need useful alt text outside the image.</p>
<nav><a href="report.json">Full geometry / hashes / timings</a>${sheets.map((sheet) => `<a href="${escapeHtml(sheet)}">${escapeHtml(sheet)}</a>`).join('')}</nav>
<p>Review on both mattes and at native/360px size. Images open at full resolution.</p>
<input id="light" type="checkbox"><label for="light">White matte</label><input id="narrow" type="checkbox"><label for="narrow">360px preview</label>
<div class="previews">${panels}</div>
</body></html>\n`;
}
