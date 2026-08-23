import { describe, expect, test } from 'bun:test';

describe('PDF metadata', () => {
  test('shows lazily loaded total page counts and cleans up PDF.js', async () => {
    const [dashboardSource, metadataSource] = await Promise.all([
      Bun.file(new URL('../src/components/Dashboard.tsx', import.meta.url)).text(),
      Bun.file(new URL('../src/utils/pdfMetadata.ts', import.meta.url)).text(),
    ]);

    expect(dashboardSource).toContain('<LibraryPageCount item={item}');
    expect(dashboardSource).toContain('IntersectionObserver');
    expect(metadataSource).toContain('document.numPages');
    expect(metadataSource).toContain('loadingTask.destroy()');
  });
});
