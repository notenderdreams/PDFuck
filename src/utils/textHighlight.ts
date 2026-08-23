import type { TextHighlightAnnotation } from './types';

interface ClientRectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export function normalizeSelectionRects(
  rects: ClientRectLike[],
  pageRect: ClientRectLike
): TextHighlightAnnotation['rects'] {
  if (pageRect.width <= 0 || pageRect.height <= 0) return [];

  return rects.flatMap((rect) => {
    const left = Math.max(rect.left, pageRect.left);
    const top = Math.max(rect.top, pageRect.top);
    const right = Math.min(rect.right, pageRect.right);
    const bottom = Math.min(rect.bottom, pageRect.bottom);

    if (right <= left || bottom <= top) return [];

    return [
      {
        x: (left - pageRect.left) / pageRect.width,
        y: (top - pageRect.top) / pageRect.height,
        width: (right - left) / pageRect.width,
        height: (bottom - top) / pageRect.height,
      },
    ];
  });
}

export function createTextHighlightsFromSelection(
  selection: Selection | null,
  color: string,
  opacity: number
): TextHighlightAnnotation[] {
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
    (page, index) => {
      const pageNumber = Number(page.dataset.pdfPageNumber);
      if (!Number.isInteger(pageNumber) || pageNumber < 1) return [];

      const rects = normalizeSelectionRects(rangeRects, page.getBoundingClientRect());
      if (rects.length === 0) return [];

      return [
        {
          id: `text_highlight_${createdAt}_${pageNumber}_${index}`,
          pageNumber,
          type: 'highlight-text' as const,
          rects,
          text,
          color,
          opacity,
          createdAt,
        },
      ];
    }
  );
}
