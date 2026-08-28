import { describe, expect, test } from 'bun:test';

const projectFile = (path: string) => Bun.file(new URL(`../${path}`, import.meta.url)).text();

describe('PDF text selection', () => {
  test('keeps the PDF.js text layer selectable and gives selected text visible blue feedback', async () => {
    const [pageSource, styles] = await Promise.all([
      projectFile('src/components/PDFPage.tsx'),
      projectFile('src/index.css'),
    ]);

    expect(pageSource).toContain("activeTool === 'select'");
    expect(pageSource).toContain('select-text pointer-events-auto cursor-text');
    expect(pageSource).toContain('data-pdf-canvas-layer');
    expect(pageSource).toContain('data-pdf-text-layer');
    expect(pageSource.indexOf('data-pdf-text-layer')).toBeGreaterThan(
      pageSource.indexOf('data-pdf-canvas-layer')
    );

    const selectionRule = styles.match(/\.textLayer ::selection\s*{([^}]*)}/)?.[1] ?? '';
    expect(selectionRule).toContain('rgba(0, 122, 255');
    expect(selectionRule).not.toContain('rgba(255, 255, 255');
  });

  test('offers "Copy text" in reader context menu to copy selected text', async () => {
    const [contextMenuSource, pageSource] = await Promise.all([
      projectFile('src/components/PageContextMenu.tsx'),
      projectFile('src/components/PDFPage.tsx'),
    ]);

    expect(contextMenuSource).toContain('Copy text');
    expect(contextMenuSource).toContain('onCopySelectedText');
    expect(contextMenuSource).toContain('hasSelectedText');
    expect(pageSource).toContain('onCopySelectedText');
    expect(pageSource).toContain('handleCopySelectedText');
  });
});
