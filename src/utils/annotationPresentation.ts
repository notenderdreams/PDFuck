import type { Annotation } from './types';
import { extractTextFromDomPageRegion } from './textHighlight';

export interface AnnotationListPresentation {
  title: string;
  preview?: string;
  prompt?: string;
  isAi: boolean;
}

const compact = (value: string): string => value.replace(/\s+/g, ' ').trim();

export function getAnnotationListPresentation(
  annotation: Annotation
): AnnotationListPresentation {
  if (annotation.type === 'ai-explanation') {
    const response = compact(annotation.response || '');
    const prompt = compact(annotation.prompt || '');
    return {
      title: response ? 'AI response' : 'AI prompt',
      prompt: prompt || undefined,
      preview: response || prompt || 'Waiting for a prompt',
      isAi: true,
    };
  }

  if (annotation.type === 'text-note') {
    const text = compact(annotation.text || '');
    return {
      title: annotation.kind === 'sticky' ? 'Sticky note' : 'Text note',
      preview: text || undefined,
      isAi: false,
    };
  }

  if (annotation.type === 'highlight-text') {
    const text = compact(annotation.text || '');
    return {
      title: annotation.style === 'underline' ? 'Underline' : 'Highlight',
      preview: text || undefined,
      isAi: false,
    };
  }

  if (annotation.type === 'highlight-rect') {
    let text = compact(annotation.text || '');
    if (!text) {
      text = compact(
        extractTextFromDomPageRegion(annotation.pageNumber, {
          x: annotation.x,
          y: annotation.y,
          width: annotation.width,
          height: annotation.height,
        })
      );
    }
    const title =
      annotation.style === 'underline'
        ? 'Underline'
        : annotation.style === 'stroke'
          ? 'Box highlight'
          : 'Highlight';
    return {
      title,
      preview: text || undefined,
      isAi: false,
    };
  }

  if (annotation.type === 'highlight-line') {
    let text = compact(annotation.text || '');
    if (!text) {
      const minX = Math.min(annotation.startX, annotation.endX);
      const minY = Math.min(annotation.startY, annotation.endY);
      const w = Math.max(0.01, Math.abs(annotation.endX - annotation.startX));
      const h = Math.max(0.02, Math.abs(annotation.endY - annotation.startY));
      text = compact(
        extractTextFromDomPageRegion(annotation.pageNumber, {
          x: minX,
          y: minY,
          width: w,
          height: h,
        })
      );
    }
    return {
      title: annotation.style === 'underline' ? 'Underline' : 'Line highlight',
      preview: text || undefined,
      isAi: false,
    };
  }

  if (annotation.type === 'pen' || annotation.type === 'highlight-pen') {
    let text = compact(annotation.text || '');
    if (!text && annotation.points && annotation.points.length > 0) {
      let minX = 1;
      let maxX = 0;
      let minY = 1;
      let maxY = 0;
      for (const p of annotation.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      text = compact(
        extractTextFromDomPageRegion(annotation.pageNumber, {
          x: minX,
          y: minY,
          width: Math.max(0.01, maxX - minX),
          height: Math.max(0.01, maxY - minY),
        })
      );
    }
    return {
      title: annotation.type === 'highlight-pen' ? 'Ink highlight' : 'Drawing',
      preview: text || undefined,
      isAi: false,
    };
  }

  if (annotation.type === 'image') {
    return {
      title: 'Image',
      preview: annotation.name || annotation.extractedText || undefined,
      isAi: false,
    };
  }

  return {
    title: (annotation as { type: string }).type.replace('-', ' '),
    isAi: false,
  };
}
