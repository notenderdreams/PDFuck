import type { HighlightStyle } from './types';

export function toggleHighlightStyle(
  currentStyle: HighlightStyle,
  requestedStyle: Exclude<HighlightStyle, 'box'>
): HighlightStyle {
  return currentStyle === requestedStyle ? 'box' : requestedStyle;
}

export function resolveHighlightOpacity(style: HighlightStyle, opacity: number): number {
  return style === 'box' ? opacity : 1;
}
