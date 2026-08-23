import { describe, expect, test } from 'bun:test';
import { normalizeSelectionRects } from '../src/utils/textHighlight';

describe('normalizeSelectionRects', () => {
  test('converts browser selection rectangles to normalized PDF page coordinates', () => {
    const rects = normalizeSelectionRects(
      [{ left: 120, top: 240, right: 320, bottom: 260, width: 200, height: 20 }],
      { left: 100, top: 200, right: 500, bottom: 800, width: 400, height: 600 }
    );

    expect(rects).toEqual([
      {
        x: 0.05,
        y: 40 / 600,
        width: 0.5,
        height: 20 / 600,
      },
    ]);
  });

  test('clips selection fragments at page boundaries and ignores other pages', () => {
    const page = { left: 100, top: 100, right: 500, bottom: 700, width: 400, height: 600 };
    const rects = normalizeSelectionRects(
      [
        { left: 80, top: 120, right: 180, bottom: 140, width: 100, height: 20 },
        { left: 120, top: 720, right: 220, bottom: 740, width: 100, height: 20 },
      ],
      page
    );

    expect(rects).toEqual([
      {
        x: 0,
        y: 20 / 600,
        width: 0.2,
        height: 20 / 600,
      },
    ]);
  });
});
