import { describe, expect, test } from 'bun:test';

const projectFile = (path: string) => Bun.file(new URL(`../${path}`, import.meta.url)).text();

describe('Highlight layer and line highlight selection', () => {
  test('renders highlights in a dedicated blend-mode layer so they render under text', async () => {
    const canvasSource = await projectFile('src/components/AnnotationCanvas.tsx');

    expect(canvasSource).toContain('data-pdf-highlight-layer');
    expect(canvasSource).toContain("mixBlendMode: isInvertedColorMode ? 'screen' : 'multiply'");
    expect(canvasSource).toContain('data-pdf-drawing-layer');
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
