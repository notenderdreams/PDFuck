import { describe, expect, test } from 'bun:test';

const projectFile = (path: string) => Bun.file(new URL(`../${path}`, import.meta.url)).text();

describe('Highlight layer and line highlight selection', () => {
  test('renders highlights in a dedicated blend-mode layer so they render under text', async () => {
    const canvasSource = await projectFile('src/components/AnnotationCanvas.tsx');
    const pageSource = await projectFile('src/components/PDFPage.tsx');

    expect(canvasSource).toContain('data-pdf-highlight-layer');
    expect(canvasSource).toContain("mixBlendMode: isInvertedColorMode ? 'screen' : 'multiply'");
    expect(canvasSource).toContain('data-pdf-drawing-layer');

    // The canvas wrapper itself must not create a stacking context above PDF.js's
    // text layer. Its children straddle the text layer instead: highlight fills
    // below it, with drawings and interactive controls above it.
    expect(pageSource).toContain('data-pdf-text-layer');
    expect(pageSource).toContain('leading-none z-10');
    expect(canvasSource).not.toContain('absolute inset-0 z-20 select-none touch-none');
    expect(canvasSource).toContain(
      'data-pdf-highlight-layer\n        className="w-full h-full absolute inset-0 z-[5] pointer-events-none"'
    );
    expect(canvasSource).toContain(
      'data-pdf-drawing-layer\n        className="w-full h-full absolute inset-0 z-20 pointer-events-none"'
    );
  });

  test('makes straight line highlights selectable, draggable, and resizable with endpoint handles', async () => {
    const canvasSource = await projectFile('src/components/AnnotationCanvas.tsx');

    // Selected highlight supports highlight-line
    expect(canvasSource).toContain("a.type === 'highlight-line'");
    expect(canvasSource).toContain('handleLineDragStart');
    expect(canvasSource).toContain('handleLineEndpointDragStart');

    // Hit targets and endpoint handles for highlight-line
    expect(canvasSource).toContain('hit_line_');
    expect(canvasSource).toContain('Drag to adjust start point');
    expect(canvasSource).toContain('Drag to adjust end point');
  });
});
