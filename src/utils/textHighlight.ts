import type { TextHighlightAnnotation, RectHighlightAnnotation } from './types';

export interface ClientRectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Merges and smooths fragmented DOM selection client rects into unified horizontal line bars.
 * Fixes jitter, subpixel discrepancies, and breaks between words across line spans.
 */
export function normalizeSelectionRects(
  rawRects: ClientRectLike[],
  pageRect: ClientRectLike
): TextHighlightAnnotation['rects'] {
  if (pageRect.width <= 0 || pageRect.height <= 0 || rawRects.length === 0) {
    return [];
  }

  // 1. Clamp rects to page boundaries and discard subpixel/degenerate fragments
  const validRects: ClientRectLike[] = [];
  for (const r of rawRects) {
    const left = Math.max(r.left, pageRect.left);
    const top = Math.max(r.top, pageRect.top);
    const right = Math.min(r.right, pageRect.right);
    const bottom = Math.min(r.bottom, pageRect.bottom);
    const width = right - left;
    const height = bottom - top;

    if (width > 0.5 && height > 0.5) {
      validRects.push({ left, top, right, bottom, width, height });
    }
  }

  if (validRects.length === 0) return [];

  // 2. Sort rects primarily top-to-bottom, secondarily left-to-right
  validRects.sort((a, b) => a.top - b.top || a.left - b.left);

  // 3. Cluster rects into lines based on vertical overlap
  const lines: ClientRectLike[][] = [];
  for (const rect of validRects) {
    let matchedLine: ClientRectLike[] | null = null;

    for (const line of lines) {
      const lineTop = Math.min(...line.map((r) => r.top));
      const lineBottom = Math.max(...line.map((r) => r.bottom));
      const lineHeight = lineBottom - lineTop;

      const overlap = Math.min(rect.bottom, lineBottom) - Math.max(rect.top, lineTop);
      const minH = Math.min(rect.height, lineHeight);
      const centerDist = Math.abs((rect.top + rect.bottom) / 2 - (lineTop + lineBottom) / 2);

      // Overlaps by at least 35% of height or line centers are close
      if (overlap >= minH * 0.35 || centerDist <= minH * 0.55) {
        matchedLine = line;
        break;
      }
    }

    if (matchedLine) {
      matchedLine.push(rect);
    } else {
      lines.push([rect]);
    }
  }

  // 4. For each line cluster, unify the vertical bounds and bridge horizontal word gaps into smooth bars
  const smoothedRects: ClientRectLike[] = [];

  for (const line of lines) {
    line.sort((a, b) => a.left - b.left);

    const lineTop = Math.min(...line.map((r) => r.top));
    const lineBottom = Math.max(...line.map((r) => r.bottom));
    const lineHeight = lineBottom - lineTop;

    let currentBar: ClientRectLike = {
      left: line[0].left,
      top: lineTop,
      right: line[0].right,
      bottom: lineBottom,
      width: line[0].right - line[0].left,
      height: lineHeight,
    };

    for (let i = 1; i < line.length; i++) {
      const next = line[i];
      const gap = next.left - currentBar.right;
      // Bridge word gaps (up to 1.8x line height or 24px) to form a smooth single line bar
      const maxBridgeableGap = Math.max(20, lineHeight * 1.8);

      if (gap <= maxBridgeableGap) {
        currentBar.right = Math.max(currentBar.right, next.right);
        currentBar.width = currentBar.right - currentBar.left;
      } else {
        smoothedRects.push(currentBar);
        currentBar = {
          left: next.left,
          top: lineTop,
          right: next.right,
          bottom: lineBottom,
          width: next.right - next.left,
          height: lineHeight,
        };
      }
    }

    smoothedRects.push(currentBar);
  }

  // 5. Convert to normalized coordinates relative to pageRect
  return smoothedRects.map((r) => ({
    x: (r.left - pageRect.left) / pageRect.width,
    y: (r.top - pageRect.top) / pageRect.height,
    width: r.width / pageRect.width,
    height: r.height / pageRect.height,
  }));
}

export function createTextHighlightsFromSelection(
  selection: Selection | null,
  color: string,
  opacity: number
): RectHighlightAnnotation[] {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return [];

  const anchorElement = selection.anchorNode instanceof Element
    ? selection.anchorNode
    : selection.anchorNode?.parentElement;
  const focusElement = selection.focusNode instanceof Element
    ? selection.focusNode
    : selection.focusNode?.parentElement;

  if (
    !anchorElement?.closest('[data-pdf-text-layer]') ||
    !focusElement?.closest('[data-pdf-text-layer]')
  ) {
    return [];
  }

  const text = selection.toString().trim();
  if (!text) return [];

  const rangeRects = Array.from(selection.getRangeAt(0).getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0
  );
  const createdAt = Date.now();

  return Array.from(document.querySelectorAll<HTMLElement>('[data-pdf-page-number]')).flatMap(
    (page) => {
      const pageNumber = Number(page.dataset.pdfPageNumber);
      if (!Number.isInteger(pageNumber) || pageNumber < 1) return [];

      const rects = normalizeSelectionRects(rangeRects, page.getBoundingClientRect());
      if (rects.length === 0) return [];

      return rects.map((rect, idx) => ({
        id: `highlight_rect_${createdAt}_${pageNumber}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        pageNumber,
        type: 'highlight-rect' as const,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color,
        opacity: opacity || 0.4,
        createdAt,
      }));
    }
  );
}
