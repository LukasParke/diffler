import {formatMetricValue} from '@lukasparke/diffler-remotion';

export type Bounds = {left: number; top: number; right: number; bottom: number};
type Edge = 'left' | 'right' | 'top' | 'bottom';
const tolerance = 1; // Logical CSS px, for fractional glyph/client-box rounding.
const clippedOverflow = /^(hidden|clip|scroll|auto)$/;

export function overflowEdges(rect: Bounds, clip: Bounds, x = true, y = true): Edge[] {
  const edges: Edge[] = [];
  if (x && rect.left < clip.left - tolerance) edges.push('left');
  if (x && rect.right > clip.right + tolerance) edges.push('right');
  if (y && rect.top < clip.top - tolerance) edges.push('top');
  if (y && rect.bottom > clip.bottom + tolerance) edges.push('bottom');
  return edges;
}

/** A random tooltip is not a certificate that the full clipped value is available. */
export function fullValueMatches(text: string, accessibleValue: string): boolean {
  const source = text.replace(/\s+/g, ' ').trim();
  const full = accessibleValue.replace(/\s+/g, ' ').trim();
  if (source.length === 0 || full.length === 0) return false;
  if (full.includes(source)) return true;
  if (!/^[\d,]+$/.test(full)) return false;
  const value = Number(full.replaceAll(',', ''));
  return Number.isSafeInteger(value) && formatMetricValue(value, 'compact') === source;
}

function ancestors(element: Element, root: Element): Element[] {
  const result: Element[] = [];
  for (let current: Element | null = element; current; current = current.parentElement) {
    result.push(current);
    if (current === root) break;
  }
  return result;
}

function isForeground(element: Element, root: Element): boolean {
  if (element.closest('[aria-hidden="true"], [hidden], script, style, defs, title, desc')) return false;
  return ancestors(element, root).every((ancestor) => {
    const style = getComputedStyle(ancestor);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse';
  });
}

function clippingBox(element: Element): Bounds {
  const rect = element.getBoundingClientRect();
  if (!(element instanceof HTMLElement)) return rect;
  const scaleX = element.offsetWidth > 0 ? rect.width / element.offsetWidth : 1;
  const scaleY = element.offsetHeight > 0 ? rect.height / element.offsetHeight : 1;
  const left = rect.left + element.clientLeft * scaleX;
  const top = rect.top + element.clientTop * scaleY;
  return {left, top, right: left + element.clientWidth * scaleX, bottom: top + element.clientHeight * scaleY};
}

function graphicBounds(element: Element): Bounds {
  const rect = element.getBoundingClientRect();
  if (!(element instanceof SVGGraphicsElement)) return rect;
  const style = getComputedStyle(element);
  const halfStroke = style.stroke === 'none' ? 0 : Number.parseFloat(style.strokeWidth) / 2;
  if (!Number.isFinite(halfStroke) || halfStroke <= 0) return rect;
  const matrix = style.vectorEffect === 'non-scaling-stroke' ? null : element.getScreenCTM();
  const x = halfStroke * (matrix ? Math.hypot(matrix.a, matrix.c) : 1);
  const y = halfStroke * (matrix ? Math.hypot(matrix.b, matrix.d) : 1);
  // getBoundingClientRect excludes SVG strokes: a horizontal/vertical chart line
  // has a zero-height/width fill box but still paints meaningful foreground ink.
  return {left: rect.left - x, top: rect.top - y, right: rect.right + x, bottom: rect.bottom + y};
}

function describe(element: Element): string {
  const label = element.getAttribute('title') ?? element.getAttribute('aria-label') ?? element.getAttribute('data-diffler');
  return `${element.tagName.toLowerCase()}${label ? ` (${label.slice(0, 90)})` : ''}`;
}

function coordinates(rect: Bounds): string {
  return [rect.left, rect.top, rect.right, rect.bottom].map((value) => value.toFixed(1)).join(', ');
}

function fullAccessibleValue(element: Element, text: string, root: Element): string | undefined {
  for (const ancestor of ancestors(element, root)) {
    const labelledBy = (ancestor.getAttribute('aria-labelledby') ?? '').split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
    const values = [ancestor.getAttribute('title'), ancestor.getAttribute('aria-label'), labelledBy];
    const match = values.find((value) => value !== null && fullValueMatches(text, value));
    if (match) return match;
  }
  return undefined;
}

export function measureForeground(root: HTMLElement, width: number, height: number) {
  const issues = new Set<string>();
  const intentionalTruncations = new Set<string>();
  let textNodesChecked = 0;
  let graphicsChecked = 0;
  const rootRect = root.getBoundingClientRect();
  const composition = {left: rootRect.left, top: rootRect.top, right: rootRect.left + width, bottom: rootRect.top + height};
  if (Math.abs(rootRect.width - width) > tolerance || Math.abs(rootRect.height - height) > tolerance) {
    issues.add(`Probe root is ${rootRect.width}×${rootRect.height}, expected ${width}×${height}`);
  }

  function check(element: Element, original: Bounds, text?: string) {
    let rect = original;
    const subject = text ? `${describe(element)} text ${JSON.stringify(text.trim().slice(0, 100))}` : describe(element);
    // Inner ellipsis is applied before checking the resulting visible ink against
    // outer clips/the composition. A title can never excuse outer overflow.
    for (const ancestor of ancestors(element, root)) {
      const style = getComputedStyle(ancestor);
      if (style.display === 'inline') continue; // CSS overflow does not clip inline boxes.
      const x = clippedOverflow.test(style.overflowX);
      const y = clippedOverflow.test(style.overflowY);
      if (!x && !y) continue;
      const clip = clippingBox(ancestor);
      let edges = overflowEdges(rect, clip, x, y);
      const horizontal = edges.includes('left') || edges.includes('right');
      const visibleWidth = Math.min(rect.right, clip.right) - Math.max(rect.left, clip.left);
      const fullValue = text && horizontal && style.textOverflow === 'ellipsis' && visibleWidth > tolerance
        ? fullAccessibleValue(ancestor, text, root) : undefined;
      if (fullValue) {
        intentionalTruncations.add(`${subject} → ellipsis in ${describe(ancestor)}; full value: ${fullValue}`);
        edges = edges.filter((edge) => edge !== 'left' && edge !== 'right');
      }
      if (edges.length > 0) {
        issues.add(`${subject} clipped at ${edges.join('/')} by ${describe(ancestor)}: ink [${coordinates(rect)}], clip [${coordinates(clip)}]`);
      }
      rect = {
        left: x ? Math.max(rect.left, clip.left) : rect.left,
        right: x ? Math.min(rect.right, clip.right) : rect.right,
        top: y ? Math.max(rect.top, clip.top) : rect.top,
        bottom: y ? Math.min(rect.bottom, clip.bottom) : rect.bottom,
      };
      if (rect.right <= rect.left || rect.bottom <= rect.top) return;
    }
    const edges = overflowEdges(rect, composition);
    if (edges.length > 0) {
      issues.add(`${subject} outside composition at ${edges.join('/')}: ink [${coordinates(rect)}], composition [${coordinates(composition)}]`);
    }
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node.parentElement;
    const text = node.textContent ?? '';
    if (!element || !text.trim() || !isForeground(element, root)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    textNodesChecked += 1;
    if (rects.length === 0) issues.add(`${describe(element)} has foreground text without a layout box: ${JSON.stringify(text)}`);
    for (const rect of rects) check(element, rect, text);
  }

  const graphics = root.querySelectorAll('img, svg, [role="img"], [role="meter"], svg path, svg circle, svg rect, svg line, svg polyline, svg polygon, svg use, svg image');
  for (const element of graphics) {
    if (!isForeground(element, root)) continue;
    const rect = graphicBounds(element);
    // Zero-width meters are legitimate measured zeroes, not missing text.
    if (rect.right === rect.left || rect.bottom === rect.top) continue;
    graphicsChecked += 1;
    check(element, rect);
  }
  if (textNodesChecked === 0) issues.add('No foreground text measured; this cannot be a passing card render.');
  return {textNodesChecked, graphicsChecked, issues: [...issues], intentionalTruncations: [...intentionalTruncations]};
}
