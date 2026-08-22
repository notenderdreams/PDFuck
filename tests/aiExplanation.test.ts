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
    expect(JSON.parse(JSON.stringify([legacy, ai]))).toEqual([legacy, ai]);
  });
});
