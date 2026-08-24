import type { Annotation } from './types';

export interface AnnotationListPresentation {
  title: string;
  preview?: string;
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
      preview: response || prompt || 'Waiting for a prompt',
      isAi: true,
    };
  }

  return {
    title: annotation.type.replace('-', ' '),
    isAi: false,
  };
}
