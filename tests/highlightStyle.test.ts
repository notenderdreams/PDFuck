import { describe, expect, test } from 'bun:test';
import {
  HIGHLIGHT_COLOR_PRESETS,
  isHighlightTool,
  resolveHighlightOpacity,
  toggleHighlightStyle,
} from '../src/utils/highlightStyle';

describe('session highlight style', () => {
  test('toggles stroke and underline modes back to the default box style', () => {
    expect(toggleHighlightStyle('box', 'stroke')).toBe('stroke');
    expect(toggleHighlightStyle('stroke', 'stroke')).toBe('box');
    expect(toggleHighlightStyle('box', 'underline')).toBe('underline');
    expect(toggleHighlightStyle('underline', 'underline')).toBe('box');
    expect(toggleHighlightStyle('stroke', 'underline')).toBe('underline');
  });

  test('keeps filled highlights translucent and renders stroke modes fully opaque', () => {
    expect(resolveHighlightOpacity('box', 0.45)).toBe(0.45);
    expect(resolveHighlightOpacity('stroke', 0.45)).toBe(1);
    expect(resolveHighlightOpacity('underline', 0.45)).toBe(1);
  });

  test('does not offer or apply underline mode to rectangle highlights', async () => {
    const [toolbarSource, canvasSource] = await Promise.all([
      Bun.file(new URL('../src/components/Toolbar.tsx', import.meta.url)).text(),
      Bun.file(new URL('../src/components/AnnotationCanvas.tsx', import.meta.url)).text(),
    ]);

    expect(toolbarSource).toContain("activeTool !== 'highlight-rect'");
    expect(canvasSource).toContain(
      "const rectHighlightStyle = highlightStyle === 'stroke' ? 'stroke' : 'box'"
    );
    expect(canvasSource).not.toContain("highlightStyle === 'underline' && rectStart");
    expect(canvasSource).not.toContain("selectedHighlight.type === 'highlight-rect' ||\n            selectedHighlight.type === 'highlight-text'");
  });

  test('maps number shortcuts to the shared palette only for highlight tools', () => {
    expect(HIGHLIGHT_COLOR_PRESETS).toHaveLength(8);
    expect(HIGHLIGHT_COLOR_PRESETS[0]).toBe('#facc15');
    expect(HIGHLIGHT_COLOR_PRESETS[7]).toBe('#ffffff');
    expect(isHighlightTool('highlight-line')).toBe(true);
    expect(isHighlightTool('highlight-pen')).toBe(true);
    expect(isHighlightTool('highlight-rect')).toBe(true);
    expect(isHighlightTool('pen')).toBe(false);
    expect(isHighlightTool('select')).toBe(false);
  });
});
