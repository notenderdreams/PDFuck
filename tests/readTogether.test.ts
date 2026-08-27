import { describe, expect, test } from 'bun:test';
import { getReadTogetherPageRows } from '../src/utils/readTogether';

describe('read together page rows', () => {
  test('wires a read-only companion PDF into the continuous viewer', async () => {
    const [appSource, viewerSource, pageSource, dashboardSource, headerSource] = await Promise.all([
      Bun.file(new URL('../src/App.tsx', import.meta.url)).text(),
      Bun.file(new URL('../src/components/PDFViewer.tsx', import.meta.url)).text(),
      Bun.file(new URL('../src/components/PDFPage.tsx', import.meta.url)).text(),
      Bun.file(new URL('../src/components/Dashboard.tsx', import.meta.url)).text(),
      Bun.file(new URL('../src/components/Header.tsx', import.meta.url)).text(),
    ]);

    expect(appSource).toContain('companionPdfDoc={companionPdfDoc}');
    expect(appSource).toContain("setViewMode('continuous')");
    expect(viewerSource).toContain('pageIdPrefix="companion-pdf-page"');
    expect(viewerSource).toContain('isReadOnly');
    expect(viewerSource).toContain('data-read-together-split');
    expect(viewerSource).toContain('data-read-together-divider');
    expect(viewerSource.match(/w-1\/2 min-w-0 flex-none flex-col overflow-hidden/g)?.length).toBe(2);
    expect(viewerSource.match(/min-h-0 flex-1 overflow-auto/g)?.length).toBe(2);
    expect(viewerSource).toContain('ref={companionContainerRef}');
    expect(viewerSource).toContain("onActivePaneChange?.('companion')");
    expect(viewerSource).toContain('scale={companionZoom}');
    expect(appSource).toContain("activeReaderPane === 'companion'");
    expect(headerSource).not.toContain('activePaneLabel');
    expect(appSource).toContain("'companion-pdf-page'");
    expect(pageSource).toContain('{!isReadOnly && <AnnotationCanvas');
    expect(dashboardSource).toContain('if (event.shiftKey)');
    expect(dashboardSource).toContain("event.key === 'Enter' && selectedPdfIds.length === 2");
    expect(dashboardSource).toContain('onOpenPdfPair(');
    expect(viewerSource).toContain('getTargetContainerForPoint');
    expect(viewerSource).toContain('handleSpaceOverlayMouseDown');
    expect(viewerSource).toContain('onMouseDown={handleSpaceOverlayMouseDown}');
    expect(viewerSource).toContain('onActivePaneChange?.(pane)');
  });

  test('continues until the longer PDF ends', () => {
    expect(getReadTogetherPageRows(2, 4)).toEqual([1, 2, 3, 4]);
    expect(getReadTogetherPageRows(5, 2)).toEqual([1, 2, 3, 4, 5]);
  });

  test('handles empty and invalid page counts without creating rows', () => {
    expect(getReadTogetherPageRows(0, 0)).toEqual([]);
    expect(getReadTogetherPageRows(-2, -1)).toEqual([]);
  });
});
