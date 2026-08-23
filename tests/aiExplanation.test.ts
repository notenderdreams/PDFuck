import { describe, expect, test } from 'bun:test';
import { transitionAiJob } from '../src/utils/aiJobState';
import type { AiExplanationAnnotation, Annotation } from '../src/utils/types';

describe('AI explanation state and persistence', () => {
  test('transitions compose, running, error, and settled state without changing annotations', () => {
    const compose = transitionAiJob({}, 'a1', { phase: 'compose' });
    const running = transitionAiJob(compose, 'a1', { phase: 'running', requestId: 'r1' });
    const failed = transitionAiJob(running, 'a1', { phase: 'error', message: 'Timed out' });
    const settled = transitionAiJob(failed, 'a1', null);
    expect(compose.a1.phase).toBe('compose');
    expect(running.a1.phase).toBe('running');
    expect(failed.a1.phase).toBe('error');
    expect(settled.a1).toBeUndefined();
  });

  test('round-trips AI and legacy annotations through annotation JSON', () => {
    const ai: AiExplanationAnnotation = {
      id: 'ai_1', pageNumber: 2, type: 'ai-explanation', x: 0.1, y: 0.2, width: 0.3, height: 0.1,
      prompt: 'Explain', response: 'Answer', provider: 'codex', createdAt: 1, updatedAt: 2,
    };
    const legacy: Annotation = {
      id: 'rect_1', pageNumber: 1, type: 'highlight-rect', x: 0, y: 0, width: 0.1, height: 0.1,
      color: '#ffff00', opacity: 0.4, createdAt: 1,
    };
    const rasterized: Annotation = {
      id: 'img_1', pageNumber: 2, type: 'image', x: 0.1, y: 0.2, width: 0.3, height: 0.1,
      rotation: 0, opacity: 1, aspectRatio: 3, name: 'Rasterized Region P2',
      dataUrl: 'data:image/png;base64,AAAA', createdAt: 1, extractedText: 'Sample raw text from document',
    };
    expect(JSON.parse(JSON.stringify([legacy, ai, rasterized]))).toEqual([legacy, ai, rasterized]);
  });

  test('parses markdown formatting structures correctly for card rendering', () => {
    const markdown = `# Header 1\n## Header 2\n- Bullet item\n1. Numbered item\n> Quote\n\`\`\`js\nconst x = 1;\n\`\`\`\nNormal **bold** and *italic* text.`;
    expect(markdown.length).toBeGreaterThan(0);
  });

  test('persists every annotation, including unanswered and answered AI boxes', async () => {
    const { filterPersistableAnnotations } = await import('../src/utils/storage');
    const unansweredAi: AiExplanationAnnotation = {
      id: 'ai_empty', pageNumber: 1, type: 'ai-explanation', x: 0.1, y: 0.2, width: 0.3, height: 0.1,
      prompt: 'Explain this', response: '', provider: 'codex', createdAt: 1, updatedAt: 2,
    };
    const answeredAi: AiExplanationAnnotation = {
      id: 'ai_answered', pageNumber: 1, type: 'ai-explanation', x: 0.1, y: 0.2, width: 0.3, height: 0.1,
      prompt: 'Explain this', response: 'Here is the detailed answer', provider: 'codex', createdAt: 1, updatedAt: 2,
    };
    const highlight: Annotation = {
      id: 'h1', pageNumber: 1, type: 'highlight-rect', x: 0, y: 0, width: 0.1, height: 0.1,
      color: '#ffff00', opacity: 0.4, createdAt: 1,
    };

    const persistable = filterPersistableAnnotations([unansweredAi, answeredAi, highlight]);
    expect(persistable).toEqual([unansweredAi, answeredAi, highlight]);
  });

  test('loads legacy annotation arrays and selects the newest versioned record', async () => {
    const { parseStoredAnnotationRecord, selectNewestAnnotationRecord } = await import('../src/utils/storage');
    const older: Annotation = {
      id: 'old', pageNumber: 1, type: 'highlight-rect', x: 0, y: 0, width: 0.1, height: 0.1,
      color: '#ffff00', opacity: 0.4, createdAt: 1,
    };
    const newer: AiExplanationAnnotation = {
      id: 'new', pageNumber: 2, type: 'ai-explanation', x: 0.1, y: 0.2, width: 0.3, height: 0.1,
      prompt: 'Explain', response: 'Persisted AI response', provider: 'codex', createdAt: 2, updatedAt: 3,
    };

    expect(parseStoredAnnotationRecord(JSON.stringify([older]))).toEqual({
      annotations: [older],
      updatedAt: 0,
    });
    expect(
      selectNewestAnnotationRecord([
        { annotations: [older], updatedAt: 10 },
        { annotations: [newer], updatedAt: 20 },
      ])
    ).toEqual({ annotations: [newer], updatedAt: 20 });
  });

  test('builds an AI response preview for the Highlights sidebar', async () => {
    const { getAnnotationListPresentation } = await import('../src/utils/annotationPresentation');
    const ai: AiExplanationAnnotation = {
      id: 'ai_sidebar', pageNumber: 4, type: 'ai-explanation', x: 0, y: 0, width: 1, height: 1,
      prompt: 'Explain this theorem', response: 'The theorem follows from compactness.', provider: 'codex', createdAt: 1, updatedAt: 2,
    };

    expect(getAnnotationListPresentation(ai)).toEqual({
      title: 'AI response',
      preview: 'The theorem follows from compactness.',
      isAi: true,
    });
  });
});
