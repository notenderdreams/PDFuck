import { describe, expect, test } from 'bun:test';
import type { SnippetEntry } from '../src/utils/types';
import { computeStitchLayout, stitchSnippetsToCanvas } from '../src/utils/snippetExtractor';

describe('computeStitchLayout', () => {
  test('calculates correct dimensions for snippets and dividers', () => {
    const dummyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const mockSnippets: SnippetEntry[] = [
      {
        id: 'snip_1',
        type: 'image',
        pageNumber: 1,
        dataUrl: dummyPng,
        width: 400,
        height: 200,
        aspectRatio: 2.0,
        createdAt: 1000,
        label: 'Page 1',
      },
      {
        id: 'div_1',
        type: 'divider',
        label: 'Section Analysis',
        style: 'solid',
        createdAt: 2000,
      },
      {
        id: 'snip_2',
        type: 'image',
        pageNumber: 2,
        dataUrl: dummyPng,
        width: 500,
        height: 300,
        aspectRatio: 1.66,
        createdAt: 3000,
        label: 'Page 2',
      },
    ];

    const layout = computeStitchLayout(mockSnippets, {
      padding: 20,
      gap: 10,
    });

    expect(layout.canvasWidth).toBeGreaterThanOrEqual(640 + 40);
    expect(layout.canvasHeight).toBeGreaterThan(500);
    expect(layout.items.length).toBe(3);
    expect(layout.items[0].entry.type).toBe('image');
    expect(layout.items[1].entry.type).toBe('divider');
    expect(layout.items[2].entry.type).toBe('image');
  });

  test('returns null gracefully when DOM is unavailable', async () => {
    const canvas = await stitchSnippetsToCanvas([]);
    expect(canvas).toBeNull();
  });
});
