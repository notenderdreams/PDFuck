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

  test('handles double click to toggle word highlight and triple click to toggle line highlight', async () => {
    const [pageSource, canvasSource, shortcutsSource, settingsSource] = await Promise.all([
      projectFile('src/components/PDFPage.tsx'),
      projectFile('src/components/AnnotationCanvas.tsx'),
      projectFile('src/components/KeyboardShortcutsModal.tsx'),
      projectFile('src/components/SettingsModal.tsx'),
    ]);

    // Text layer triple-click selection
    expect(pageSource).toContain('handleTextLayerMouseDown');
    expect(pageSource).toContain('handleTextLayerClick');
    expect(pageSource).toContain('selectFullLineAtTarget');
    expect(pageSource).toContain('e.detail >= 3');

    // Highlight tool double-click and triple-click toggling with staged selection rectangle
    expect(canvasSource).toContain('getTextLineBoundsAtPoint');
    expect(canvasSource).toContain('getWordBoundsAtPoint');
    expect(canvasSource).toContain('findHighlightAnnotationsCoveringLine');
    expect(canvasSource).toContain('findHighlightAnnotationsCoveringWord');
    expect(canvasSource).toContain('doubleClickTimerRef');
    expect(canvasSource).toContain('pendingSelection');
    expect(canvasSource).toContain('commitPendingSelection');
    expect(canvasSource).toContain('data-pdf-selection-rectangle');

    // Discoverable in shortcuts and settings
    expect(shortcutsSource).toContain('Double Click');
    expect(shortcutsSource).toContain('Highlight / Remove Word Highlight');
    expect(shortcutsSource).toContain('Triple Click');
    expect(shortcutsSource).toContain('Highlight / Remove Line Highlight');

    expect(settingsSource).toContain('Double Click');
    expect(settingsSource).toContain('Highlight / Remove Word Highlight');
    expect(settingsSource).toContain('Triple Click');
    expect(settingsSource).toContain('Highlight / Remove Line Highlight');
  });
});
