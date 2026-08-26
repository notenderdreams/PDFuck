import type { HighlightStyle, ToolType } from './types';

export const HIGHLIGHT_COLOR_PRESETS = [
  '#facc15',
  '#fbbf24',
  '#4ade80',
  '#38bdf8',
  '#fb7185',
  '#c084fc',
  '#f87171',
  '#ffffff',
] as const;

export function isHighlightTool(tool: ToolType): boolean {
  return tool === 'highlight-line' || tool === 'highlight-pen' || tool === 'highlight-rect';
}

export function toggleHighlightStyle(
  currentStyle: HighlightStyle,
  requestedStyle: Exclude<HighlightStyle, 'box'>
): HighlightStyle {
  return currentStyle === requestedStyle ? 'box' : requestedStyle;
}

export function resolveHighlightOpacity(style: HighlightStyle, opacity: number): number {
  return style === 'box' ? opacity : 1;
}
