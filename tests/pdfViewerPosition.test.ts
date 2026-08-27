import { describe, expect, test } from 'bun:test';
import {
  keepViewerPositionAfter,
  shouldRestoreViewerPosition,
} from '../src/utils/viewerPosition';

describe('PDF viewer position restoration', () => {
  test('does not restore or recenter when only the active page changes', () => {
    expect(shouldRestoreViewerPosition(true, false, false)).toBe(false);
  });

  test('restores position when a document opens or the view mode changes', () => {
    expect(shouldRestoreViewerPosition(true, true, false)).toBe(true);
    expect(shouldRestoreViewerPosition(true, false, true)).toBe(true);
  });

  test('restores the exact viewer position after a focused text editor is removed', () => {
    const viewer = { scrollLeft: 125, scrollTop: 8450 };
    const editor = {
      closest: (selector: string) => (selector === '.pdf-viewer-viewport' ? viewer : null),
    };
    const scheduled: Array<() => void> = [];

    keepViewerPositionAfter(
      editor as unknown as HTMLElement,
      () => {
        viewer.scrollLeft = 900;
        viewer.scrollTop = 13200;
      },
      (restore) => scheduled.push(restore)
    );
    scheduled.forEach((restore) => restore());

    expect(viewer).toEqual({ scrollLeft: 125, scrollTop: 8450 });
  });
});
