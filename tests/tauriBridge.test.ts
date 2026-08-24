import { describe, expect, test, mock } from 'bun:test';
import { openExternalUrl } from '../src/utils/tauriBridge';

describe('openExternalUrl', () => {
  test('falls back to window.open in browser mode', async () => {
    let openedUrl = '';
    let targetParam = '';
    let featuresParam = '';

    const originalWindowOpen = globalThis.window?.open;
    globalThis.window = {
      ...globalThis.window,
      open: mock((url: string, target?: string, features?: string) => {
        openedUrl = url;
        targetParam = target ?? '';
        featuresParam = features ?? '';
        return null;
      }),
    } as unknown as Window & typeof globalThis;

    await openExternalUrl('https://github.com/notenderdreams/PDFuck');

    expect(openedUrl).toBe('https://github.com/notenderdreams/PDFuck');
    expect(targetParam).toBe('_blank');
    expect(featuresParam).toBe('noopener,noreferrer');

    if (originalWindowOpen) {
      globalThis.window.open = originalWindowOpen;
    }
  });
});
