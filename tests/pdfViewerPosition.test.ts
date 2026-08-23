import { describe, expect, test } from 'bun:test';
import { shouldRestoreViewerPosition } from '../src/utils/viewerPosition';

describe('PDF viewer position restoration', () => {
  test('does not restore or recenter when only the active page changes', () => {
    expect(shouldRestoreViewerPosition(true, false, false)).toBe(false);
  });

  test('restores position when a document opens or the view mode changes', () => {
    expect(shouldRestoreViewerPosition(true, true, false)).toBe(true);
    expect(shouldRestoreViewerPosition(true, false, true)).toBe(true);
  });
});
