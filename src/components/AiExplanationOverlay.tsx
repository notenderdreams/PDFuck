import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  Check,
  Copy,
  GripHorizontal,
  Image as ImageIcon,
  Pencil,
  RotateCcw,
  Trash2,
  X,
  Send,
} from 'lucide-react';
import type { AiJobState } from '../hooks/useAiExplanations';
import type { AiExplanationAnnotation, Annotation, AttachedImageAnnotation } from '../utils/types';
import { rasterizeResponseCard } from '../utils/cardRasterizer';

const AiResponseRenderer = React.lazy(() =>
  import('./AiResponseRenderer').then((module) => ({ default: module.AiResponseRenderer }))
);

interface Props {
  pdfDoc?: PDFDocumentProxy | null;
  pageWidth: number;
  pageHeight: number;
  annotations: AiExplanationAnnotation[];
  jobs: Record<string, AiJobState>;
  onSubmit: (annotation: AiExplanationAnnotation, prompt: string) => void;
  onCancel: (id: string) => void;
  onCloseJob: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Annotation>) => void;
  onDelete: (id: string) => void;
  onAddAnnotation: (ann: Annotation) => void;
  selectedAnnotationId?: string | null;
  onSelectAnnotation?: (id: string | null) => void;
}

const DEFAULT_PROMPT = 'Explain this clearly and concisely';

const QUICK_PROMPTS = [
  'Solve step-by-step',
  'Explain clearly',
  'Summarize key points',
  'Explain formulas & math',
  'Define technical terms',
];

export const AiExplanationOverlay: React.FC<Props> = ({
  pageWidth,
  pageHeight,
  annotations,
  jobs,
  onSubmit,
  onCancel,
  onCloseJob,
  onUpdate,
  onDelete,
  onAddAnnotation,
  selectedAnnotationId,
  onSelectAnnotation,
}) => {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingResponseId, setEditingResponseId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragPositions, setDragPositions] = useState<Record<string, { left: number; top: number }>>({});
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    initialLeft: number;
    initialTop: number;
  }>({ clientX: 0, clientY: 0, initialLeft: 0, initialTop: 0 });

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const promptInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Auto-resize prompt textarea when needed
  useEffect(() => {
    for (const annotation of annotations) {
      const input = promptInputRefs.current[annotation.id];
      if (!input || annotation.response || jobs[annotation.id]?.phase === 'running') continue;
      input.style.height = '0px';
      input.style.height = `${Math.min(Math.max(input.scrollHeight, 48), 120)}px`;
    }
  }, [annotations, drafts, jobs]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedAnnotationId) {
        const selectedAnn = annotations.find((a) => a.id === selectedAnnotationId);
        if (selectedAnn) {
          if (jobs[selectedAnn.id]?.phase === 'running') {
            void onCancel(selectedAnn.id);
          }
          if (!selectedAnn.response && jobs[selectedAnn.id]?.phase !== 'running') {
            onDelete(selectedAnn.id);
            onCloseJob(selectedAnn.id);
          } else {
            onUpdate(selectedAnn.id, { isOpen: false, updatedAt: Date.now() });
          }
          onSelectAnnotation?.(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [annotations, jobs, onCancel, onCloseJob, onDelete, onSelectAnnotation, onUpdate, selectedAnnotationId]);

  const handleDragPointerDown = (
    e: React.PointerEvent,
    annotation: AiExplanationAnnotation,
    currentLeft: number,
    currentTop: number
  ) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, a, [role="button"]')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setActiveDragId(annotation.id);
    onSelectAnnotation?.(annotation.id);

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialLeft: currentLeft,
      initialTop: currentTop,
    };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleDragPointerMove = (
    e: React.PointerEvent,
    annotation: AiExplanationAnnotation,
    cardWidth: number
  ) => {
    if (activeDragId !== annotation.id) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;

    const newLeft = dragStartRef.current.initialLeft + dx;
    const newTop = dragStartRef.current.initialTop + dy;

    setDragPositions((prev) => ({
      ...prev,
      [annotation.id]: { left: newLeft, top: newTop },
    }));
  };

  const handleDragPointerUp = (
    e: React.PointerEvent,
    annotation: AiExplanationAnnotation
  ) => {
    if (activeDragId === annotation.id) {
      setActiveDragId(null);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}

      const pos = dragPositions[annotation.id];
      if (pos) {
        onUpdate(annotation.id, {
          cardX: pos.left / pageWidth,
          cardY: pos.top / pageHeight,
          updatedAt: Date.now(),
        });
      }
    }
  };

  const handleRasterizeResponse = async (targetAnnotation: AiExplanationAnnotation) => {
    const rawResponse = drafts[`response_${targetAnnotation.id}`] ?? targetAnnotation.response;
    if (!rawResponse) return;
    const cardEl = cardRefs.current[targetAnnotation.id];
    try {
      const isDark = document.documentElement.getAttribute('data-ui-theme') === 'dark';
      const raster = await rasterizeResponseCard(
        cardEl,
        targetAnnotation.prompt || 'Explain this section',
        rawResponse,
        isDark
      );

      const imgAspect = raster.width / raster.height;
      const renderPixelWidth = Math.min(pageWidth * 0.75, Math.max(380, raster.width / 2));
      const normWidth = Math.min(0.9, renderPixelWidth / pageWidth);
      const normHeight = (normWidth * pageWidth) / (imgAspect * pageHeight);

      const normX = Math.max(0.02, Math.min(targetAnnotation.x, 1 - normWidth - 0.02));
      const normY = Math.max(0.02, Math.min(targetAnnotation.y, 1 - normHeight - 0.02));

      const imageAnnotation: AttachedImageAnnotation = {
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        pageNumber: targetAnnotation.pageNumber,
        type: 'image',
        dataUrl: raster.dataUrl,
        x: normX,
        y: normY,
        width: normWidth,
        height: normHeight,
        rotation: 0,
        opacity: 1,
        aspectRatio: raster.width / raster.height,
        name: `AI Explanation: ${targetAnnotation.prompt.slice(0, 30)}`,
        createdAt: Date.now(),
        extractedText: targetAnnotation.response,
        attachedInInvertedMode: isDark,
        invertInLightMode: true,
      };

      onAddAnnotation(imageAnnotation);
      onDelete(targetAnnotation.id);
      onCloseJob(targetAnnotation.id);
      onSelectAnnotation?.(imageAnnotation.id);
    } catch (err) {
      console.error('Failed to rasterize AI response:', err);
    }
  };

  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((curr) => (curr === id ? null : curr));
      }, 1500);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      {/* 1. Interactive Selection Hitboxes for AI Regions on Canvas */}
      {annotations.map((annotation) => {
        const isSelected = selectedAnnotationId === annotation.id;

        return (
          <div
            key={`ai-hitbox-${annotation.id}`}
            data-ai-annotation-id={annotation.id}
            className={`absolute pointer-events-auto cursor-pointer transition-all duration-150 ${
              isSelected
                ? 'ring-2 ring-blue-500/80 bg-blue-500/10'
                : 'hover:bg-blue-500/10'
            }`}
            style={{
              left: `${annotation.x * pageWidth}px`,
              top: `${annotation.y * pageHeight}px`,
              width: `${annotation.width * pageWidth}px`,
              height: `${annotation.height * pageHeight}px`,
            }}
            onClick={(event) => {
              event.stopPropagation();
              onUpdate(annotation.id, { isOpen: true, updatedAt: Date.now() });
              onSelectAnnotation?.(annotation.id);
            }}
            role="button"
            tabIndex={0}
            aria-label={annotation.response ? 'Open AI explanation' : 'Open AI prompt'}
          />
        );
      })}

      {/* 2. Persistent AI Sticky Windows (Rendered inside reader page) */}
      {annotations.map((annotation) => {
        const job = jobs[annotation.id];
        const isRunning = job?.phase === 'running';
        const isPromptComposer = !annotation.response && !isRunning;
        const isOpen = annotation.isOpen !== false || isPromptComposer || isRunning || selectedAnnotationId === annotation.id;

        if (!isOpen) return null;

        const isSelected = selectedAnnotationId === annotation.id;
        const cardWidth = isPromptComposer
          ? Math.min(420, Math.max(280, pageWidth - 24))
          : Math.min(440, Math.max(300, pageWidth - 24));

        // Calculate card position strictly clamped inside page bounds
        let cardLeft: number;
        let cardTop: number;

        const liveDrag = dragPositions[annotation.id];
        if (liveDrag) {
          cardLeft = liveDrag.left;
          cardTop = liveDrag.top;
        } else if (annotation.cardX !== undefined && annotation.cardY !== undefined) {
          cardLeft = annotation.cardX * pageWidth;
          cardTop = annotation.cardY * pageHeight;
        } else {
          const selectionLeft = annotation.x * pageWidth;
          const selectionRight = (annotation.x + annotation.width) * pageWidth;
          const selectionTop = annotation.y * pageHeight;
          const selectionBottom = (annotation.y + annotation.height) * pageHeight;

          if (isPromptComposer) {
            cardLeft = Math.max(8, Math.min(selectionLeft, pageWidth - cardWidth - 8));
            cardTop = selectionBottom + 10;
          } else {
            // Default placement in margin next to selection
            const rightSpace = pageWidth - selectionRight;
            if (rightSpace >= cardWidth * 0.6) {
              cardLeft = selectionRight + 16;
              cardTop = selectionTop;
            } else {
              const leftSpace = selectionLeft;
              if (leftSpace >= cardWidth * 0.6) {
                cardLeft = selectionLeft - cardWidth - 16;
                cardTop = selectionTop;
              } else {
                cardLeft = selectionRight + 16;
                cardTop = selectionTop;
              }
            }
          }
        }

        const isEditing = editingResponseId === annotation.id;

        return (
          <div
            key={`ai-card-${annotation.id}`}
            ref={(el) => {
              cardRefs.current[annotation.id] = el;
            }}
            style={{
              width: `${cardWidth}px`,
              left: `${cardLeft}px`,
              top: `${cardTop}px`,
            }}
            role="dialog"
            aria-label="AI explanation note"
            className={`absolute pointer-events-auto flex flex-col overscroll-contain z-30 ${
              isPromptComposer
                ? 'ai-prompt-composer-stack'
                : `macos-ai-popover max-h-[min(78vh,600px)] overflow-hidden ${
                    isSelected ? 'ring-1 ring-blue-500/40 shadow-2xl' : ''
                  }`
            }`}
            onPointerDown={(event) => {
              event.stopPropagation();
              onSelectAnnotation?.(annotation.id);
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
          >
            {/* Window Header with Drag Handle */}
            {!isPromptComposer && (
              <div
                onPointerDown={(e) => handleDragPointerDown(e, annotation, cardLeft, cardTop)}
                onPointerMove={(e) => handleDragPointerMove(e, annotation, cardWidth)}
                onPointerUp={(e) => handleDragPointerUp(e, annotation)}
                onPointerCancel={(e) => handleDragPointerUp(e, annotation)}
                className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-[var(--border)] shrink-0 select-none bg-[var(--popover)]/60 backdrop-blur-xs cursor-grab active:cursor-grabbing"
                title="Drag to move sticky note"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <GripHorizontal className="w-3.5 h-3.5 text-[var(--muted-foreground)] opacity-70 hover:opacity-100 shrink-0" />
                  <span className="text-[var(--foreground)] font-medium tracking-tight">AI Assistant</span>
                  {isRunning && (
                    <span className="text-[10px] font-medium text-blue-400 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded-full flex items-center gap-1.5 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                      Thinking…
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="macos-ai-action-btn w-6 h-6 rounded-md"
                    onClick={() => {
                      if (isRunning) void onCancel(annotation.id);
                      if (!annotation.response && !isRunning) {
                        onDelete(annotation.id);
                        onCloseJob(annotation.id);
                      } else {
                        onUpdate(annotation.id, { isOpen: false, updatedAt: Date.now() });
                      }
                      onSelectAnnotation?.(null);
                    }}
                    aria-label="Close"
                    title="Close sticky note"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Scrollable Body */}
            <div
              className={`flex-1 min-h-0 flex flex-col gap-3 select-text overscroll-contain ${
                isPromptComposer
                  ? ''
                  : 'p-3.5 overflow-y-auto overflow-x-hidden macos-thin-scrollbar'
              }`}
              onWheel={(event) => event.stopPropagation()}
            >
              {/* Prompt Composer or Thinking State */}
              {(!annotation.response || isRunning) && (
                <>
                  {isRunning ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/60 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          Question
                        </div>
                        <div className="text-xs font-medium text-[var(--foreground)] leading-relaxed">
                          {drafts[annotation.id] ?? annotation.prompt ?? DEFAULT_PROMPT}
                        </div>
                      </div>

                      {/* Clean Text-Driven Shimmer Thinking Box */}
                      <div className="macos-ai-thinking-box p-3.5 flex flex-col gap-2.5">
                        <div className="macos-ai-thinking-shimmer" />
                        <div className="flex flex-col gap-2 relative z-10">
                          <div className="flex items-center justify-between">
                            <span className="ai-text-shimmer text-xs">
                              Thinking & generating explanation…
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              Analyzing context
                            </span>
                          </div>

                          <div className="flex flex-col gap-1.5 pt-0.5">
                            <div className="ai-skeleton-line w-full" />
                            <div className="ai-skeleton-line w-4/5" />
                            <div className="ai-skeleton-line w-3/5" />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          className="btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => void onCancel(annotation.id)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="ai-prompt-composer-content flex flex-col gap-2">
                      <div className="ai-prompt-presets flex flex-wrap gap-1.5 px-0.5">
                        {QUICK_PROMPTS.map((qp) => (
                          <button
                            key={qp}
                            type="button"
                            onClick={() => {
                              setDrafts((current) => ({ ...current, [annotation.id]: qp }));
                              onUpdate(annotation.id, { prompt: qp, updatedAt: Date.now() });
                            }}
                            className="ai-prompt-preset"
                          >
                            {qp}
                          </button>
                        ))}
                      </div>

                      <div className="ai-prompt-composer">
                        <textarea
                          ref={(el) => {
                            promptInputRefs.current[annotation.id] = el;
                          }}
                          id={`ai-prompt-${annotation.id}`}
                          autoFocus
                          rows={2}
                          aria-label="Ask AI about this selection"
                          value={drafts[annotation.id] ?? annotation.prompt}
                          onChange={(event) => {
                            setDrafts((current) => ({
                              ...current,
                              [annotation.id]: event.target.value,
                            }));
                            onUpdate(annotation.id, {
                              prompt: event.target.value,
                              updatedAt: Date.now(),
                            });
                          }}
                          onKeyDown={(event) => {
                            if (
                              event.key === 'Enter' &&
                              (event.metaKey || event.ctrlKey || !event.shiftKey)
                            ) {
                              event.preventDefault();
                              const promptText = (drafts[annotation.id] ?? annotation.prompt).trim();
                              if (promptText) onSubmit(annotation, promptText);
                            }
                          }}
                          placeholder="Ask about this selection…"
                          className="ai-prompt-composer-input w-full resize-none text-sm leading-6 font-sans"
                        />
                        <button
                          type="button"
                          className="ai-prompt-send"
                          disabled={!(drafts[annotation.id] ?? annotation.prompt).trim()}
                          onClick={() => onSubmit(annotation, drafts[annotation.id] ?? annotation.prompt)}
                          title="Explain selection (Enter)"
                          aria-label="Send prompt"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {job?.phase === 'error' && (
                        <div
                          className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg"
                          role="alert"
                        >
                          {job.message}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Settled AI Response View */}
              {annotation.response && !isRunning && (
                <div className="flex flex-col gap-3">
                  <div
                    data-ai-question="true"
                    className="flex flex-col gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/60 p-3"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Question
                    </div>
                    <div className="text-xs font-medium text-[var(--foreground)] leading-relaxed">
                      {annotation.prompt || drafts[annotation.id] || DEFAULT_PROMPT}
                    </div>
                  </div>

                  {isEditing ? (
                    <textarea
                      autoFocus
                      rows={8}
                      value={drafts[`response_${annotation.id}`] ?? annotation.response}
                      onChange={(event) => {
                        setDrafts((current) => ({
                          ...current,
                          [`response_${annotation.id}`]: event.target.value,
                        }));
                      }}
                      className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--input)] p-2.5 text-xs text-[var(--foreground)] leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                    />
                  ) : (
                    <div className="py-0.5 px-0.5">
                      <React.Suspense
                        fallback={
                          <div className="text-xs text-zinc-400 p-2">
                            Rendering explanation…
                          </div>
                        }
                      >
                        <AiResponseRenderer response={annotation.response} />
                      </React.Suspense>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sticky Action Footer */}
            {annotation.response && !isRunning && (
              <div className="flex items-center justify-between px-3.5 py-2 border-t border-[var(--border)] shrink-0 bg-[var(--secondary)]/40 backdrop-blur-xs select-none">
                <div className="text-[10px] text-zinc-400 font-mono">
                  {Math.round(annotation.response.split(/\s+/).filter(Boolean).length)} words
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="macos-ai-action-btn"
                    title="Rasterize explanation into adjustable image on page"
                    onClick={() => void handleRasterizeResponse(annotation)}
                    aria-label="Rasterize as Image"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    className="macos-ai-action-btn"
                    title={copiedId === annotation.id ? 'Copied to clipboard' : 'Copy response'}
                    onClick={() => void handleCopyText(annotation.response, annotation.id)}
                    aria-label="Copy Response"
                  >
                    {copiedId === annotation.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="macos-ai-action-btn"
                    title={isEditing ? 'Save edit' : 'Edit response'}
                    onClick={() => {
                      if (isEditing) {
                        onUpdate(annotation.id, {
                          response: drafts[`response_${annotation.id}`] ?? annotation.response,
                          updatedAt: Date.now(),
                        });
                        setEditingResponseId(null);
                      } else {
                        setEditingResponseId(annotation.id);
                      }
                    }}
                    aria-label={isEditing ? 'Save edit' : 'Edit response'}
                  >
                    {isEditing ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Pencil className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="macos-ai-action-btn"
                    title="Regenerate"
                    onClick={() => {
                      setDrafts((current) => ({ ...current, [annotation.id]: annotation.prompt }));
                      onCloseJob(annotation.id);
                      onSubmit(annotation, annotation.prompt);
                    }}
                    aria-label="Regenerate"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    className="macos-ai-action-btn macos-ai-action-btn-danger"
                    title="Delete"
                    onClick={() => {
                      onDelete(annotation.id);
                      onCloseJob(annotation.id);
                    }}
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
