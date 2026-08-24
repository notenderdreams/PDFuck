import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  Check,
  Copy,
  GripHorizontal,
  Image as ImageIcon,
  Pencil,
  RotateCcw,
  Sparkles,
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
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingResponse, setEditingResponse] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragOffsets, setDragOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    initialX: number;
    initialY: number;
  }>({ clientX: 0, clientY: 0, initialX: 0, initialY: 0 });

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const prevActiveRef = useRef<AiExplanationAnnotation | null>(null);

  const activeJobId = Object.keys(jobs).find((id) =>
    annotations.some((annotation) => annotation.id === id)
  );
  const activeId = activeJobId || openId;
  const active = annotations.find((annotation) => annotation.id === activeId);
  const job = active ? jobs[active.id] : undefined;

  useEffect(() => {
    if (activeJobId && openId !== activeJobId) {
      setOpenId(activeJobId);
    }
  }, [activeJobId, openId]);

  useEffect(() => {
    if (
      selectedAnnotationId &&
      annotations.some((annotation) => annotation.id === selectedAnnotationId)
    ) {
      setOpenId(selectedAnnotationId);
    }
  }, [annotations, selectedAnnotationId]);

  // Clean up previous unsubmitted AI selections when switching away
  useEffect(() => {
    const prev = prevActiveRef.current;
    if (prev && prev.id !== active?.id) {
      if (!prev.response && jobs[prev.id]?.phase !== 'running') {
        onDelete(prev.id);
        onCloseJob(prev.id);
      }
    }
    prevActiveRef.current = active ?? null;
  }, [active, jobs, onCloseJob, onDelete]);

  // Clean up unsubmitted AI selection on unmount
  useEffect(() => {
    return () => {
      const current = prevActiveRef.current;
      if (current && !current.response && jobs[current.id]?.phase !== 'running') {
        onDelete(current.id);
        onCloseJob(current.id);
      }
    };
  }, [jobs, onCloseJob, onDelete]);

  // Reset local state when active annotation changes
  useEffect(() => {
    if (!active) {
      return;
    }
    setEditingResponse(false);
    setDrafts((current) =>
      current[active.id] === undefined
        ? { ...current, [active.id]: active.prompt }
        : current
    );
  }, [active?.id]);

  useEffect(() => {
    const input = promptInputRef.current;
    if (!input || active?.response || job?.phase === 'running') return;
    input.style.height = '0px';
    input.style.height = `${Math.min(Math.max(input.scrollHeight, 48), 120)}px`;
  }, [active?.id, active?.response, drafts, job?.phase]);

  useEffect(() => {
    if (!activeId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (job?.phase === 'running') void onCancel(activeId);
        else onCloseJob(activeId);
        if (active && !active.response && job?.phase !== 'running') {
          onDelete(active.id);
        }
        setOpenId(null);
        onSelectAnnotation?.(null);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [activeId, active, job?.phase, onCancel, onCloseJob, onDelete, onSelectAnnotation]);

  useEffect(() => {
    if (!active || isDragging) return;

    const dismissOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (popoverRef.current?.contains(target)) return;
      if (target?.closest(`[data-ai-annotation-id="${active.id}"]`)) return;

      if (job?.phase === 'running') void onCancel(active.id);
      onCloseJob(active.id);
      if (!active.response && job?.phase !== 'running') {
        onDelete(active.id);
      }
      setOpenId(null);
      onSelectAnnotation?.(null);
    };

    window.addEventListener('pointerdown', dismissOnOutsidePointer);
    return () => window.removeEventListener('pointerdown', dismissOnOutsidePointer);
  }, [active, isDragging, job?.phase, onCancel, onCloseJob, onDelete, onSelectAnnotation]);

  const handleDragPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, a, [role="button"]')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (!active) return;
    setIsDragging(true);

    const currentOffset = dragOffsets[active.id] ?? { x: 0, y: 0 };
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialX: currentOffset.x,
      initialY: currentOffset.y,
    };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleDragPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !active) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;

    setDragOffsets((prev) => ({
      ...prev,
      [active.id]: {
        x: dragStartRef.current.initialX + dx,
        y: dragStartRef.current.initialY + dy,
      },
    }));
  };

  const handleDragPointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const isPromptComposer = Boolean(active && !active.response && job?.phase !== 'running');
  const popoverWidth = isPromptComposer
    ? Math.min(460, Math.max(300, pageWidth - 24))
    : Math.min(500, Math.max(340, pageWidth - 20));

  let popoverStyle: React.CSSProperties | undefined = undefined;

  if (active) {
    const selectionLeft = active.x * pageWidth;
    const baseX = Math.max(8, Math.min(selectionLeft, pageWidth - popoverWidth - 8));
    const belowSelection = (active.y + active.height) * pageHeight + 10;
    const baseY = isPromptComposer
      ? Math.min(belowSelection, Math.max(8, pageHeight - 174))
      : Math.max(8, Math.min(active.y * pageHeight, Math.max(8, pageHeight - 240)));

    const offset = dragOffsets[active.id] ?? { x: 0, y: 0 };

    popoverStyle = {
      width: `${popoverWidth}px`,
      left: `${baseX + offset.x}px`,
      top: `${baseY + offset.y}px`,
    };
  }

  const handleRasterizeResponse = async (targetAnnotation: AiExplanationAnnotation) => {
    const rawResponse = drafts[`response_${targetAnnotation.id}`] ?? targetAnnotation.response;
    if (!rawResponse) return;
    try {
      const isDark = document.documentElement.getAttribute('data-ui-theme') === 'dark';
      const raster = await rasterizeResponseCard(
        popoverRef.current,
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
      setOpenId(null);
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
      {/* Interactive Selection Hitboxes for AI Boxes */}
      {annotations.map((annotation) => {
        const isSelected = selectedAnnotationId === annotation.id || active?.id === annotation.id;

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
              setOpenId(annotation.id);
              onSelectAnnotation?.(annotation.id);
            }}
            role="button"
            tabIndex={0}
            aria-label={annotation.response ? 'Open AI explanation' : 'Open AI prompt'}
          />
        );
      })}

      {/* The composer or explanation popover is anchored to the selected region. */}
      {active && (
        <div
          ref={popoverRef}
          style={popoverStyle}
          role="dialog"
          aria-label="AI region explanation"
          className={`absolute pointer-events-auto flex flex-col ${
            isPromptComposer
              ? 'ai-prompt-composer-stack'
              : 'macos-ai-popover max-h-[min(80vh,620px)] overflow-hidden'
          }`}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {!isPromptComposer && (
            <div
              onPointerDown={handleDragPointerDown}
              onPointerMove={handleDragPointerMove}
              onPointerUp={handleDragPointerUp}
              onPointerCancel={handleDragPointerUp}
              className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border)] shrink-0 select-none bg-[var(--popover)]/60 backdrop-blur-xs cursor-grab active:cursor-grabbing"
              title="Drag to reposition window"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <GripHorizontal className="w-3.5 h-3.5 text-[var(--muted-foreground)] opacity-70 hover:opacity-100 shrink-0" />
                <span className="flex items-center justify-center w-4.5 h-4.5 rounded-md bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 text-white shadow-xs">
                  <Sparkles className="w-2.5 h-2.5" />
                </span>
                <span className="text-zinc-100 font-medium tracking-tight">AI Assistant</span>
                {job?.phase === 'running' && (
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
                    if (job?.phase === 'running') void onCancel(active.id);
                    if (!active.response && job?.phase !== 'running') {
                      onDelete(active.id);
                    }
                    setOpenId(null);
                    onSelectAnnotation?.(null);
                    onCloseJob(active.id);
                  }}
                  aria-label="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* SCROLLABLE BODY (Handles arbitrarily long responses smoothly) */}
          <div
            className={`flex-1 min-h-0 flex flex-col gap-3 select-text ${
              isPromptComposer
                ? ''
                : 'p-3.5 overflow-y-auto overflow-x-hidden macos-thin-scrollbar'
            }`}
          >
            {/* Body: Prompting or Thinking State */}
            {(!active.response || job) && (
              <>
                {job?.phase === 'running' ? (
                  <div className="flex flex-col gap-3">
                    <div
                      className="ai-question-section self-end max-w-[85%] bg-blue-500/10 text-blue-900 dark:text-blue-100 text-[13px] px-3.5 py-2.5 rounded-2xl rounded-tr-sm border border-blue-500/20 leading-relaxed font-medium shadow-sm"
                    >
                      {drafts[active.id] ?? active.prompt ?? DEFAULT_PROMPT}
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

                        {/* Clean Shimmer Skeleton Lines */}
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
                        onClick={() => void onCancel(active.id)}
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
                            setDrafts((current) => ({ ...current, [active.id]: qp }));
                            onUpdate(active.id, { prompt: qp, updatedAt: Date.now() });
                          }}
                          className="ai-prompt-preset"
                        >
                          {qp}
                        </button>
                      ))}
                    </div>

                    <div className="ai-prompt-composer">
                      <textarea
                        ref={promptInputRef}
                        id={`ai-prompt-${active.id}`}
                        autoFocus
                        rows={2}
                        aria-label="Ask AI about this selection"
                        value={drafts[active.id] ?? active.prompt}
                        onChange={(event) => {
                          setDrafts((current) => ({
                            ...current,
                            [active.id]: event.target.value,
                          }));
                          onUpdate(active.id, {
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
                            const promptText = (drafts[active.id] ?? active.prompt).trim();
                            if (promptText) onSubmit(active, promptText);
                          }
                        }}
                        placeholder="Ask about this selection…"
                        className="ai-prompt-composer-input w-full resize-none text-sm leading-6 font-sans"
                      />
                      <button
                        type="button"
                        className="ai-prompt-send"
                        disabled={!(drafts[active.id] ?? active.prompt).trim()}
                        onClick={() => onSubmit(active, drafts[active.id] ?? active.prompt)}
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
            {active.response && !job && (
              <div className="flex flex-col gap-4">
                <div
                  data-ai-question="true"
                  className="ai-question-section self-end max-w-[85%] bg-blue-500/10 text-blue-900 dark:text-blue-100 text-[13px] px-3.5 py-2.5 rounded-2xl rounded-tr-sm border border-blue-500/20 leading-relaxed font-medium shadow-sm"
                >
                  {active.prompt}
                </div>

                {editingResponse ? (
                  <textarea
                    autoFocus
                    rows={8}
                    value={drafts[`response_${active.id}`] ?? active.response}
                    onChange={(event) => {
                      setDrafts((current) => ({
                        ...current,
                        [`response_${active.id}`]: event.target.value,
                      }));
                      onUpdate(active.id, {
                        response: event.target.value,
                        updatedAt: Date.now(),
                      });
                    }}
                    className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--input)] p-2.5 text-xs text-zinc-100 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
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
                      <AiResponseRenderer response={active.response} />
                    </React.Suspense>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STICKY FOOTER (Action Toolbar for Settled Response) */}
          {active.response && !job && (
            <div className="flex items-center justify-between px-3.5 py-2 border-t border-[var(--border)] shrink-0 bg-[var(--secondary)]/40 backdrop-blur-xs select-none">
              <div className="text-[10px] text-zinc-400 font-mono">
                {Math.round(active.response.split(/\s+/).filter(Boolean).length)} words
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="macos-ai-action-btn"
                  title="Rasterize explanation into adjustable image on page"
                  onClick={() => void handleRasterizeResponse(active)}
                  aria-label="Rasterize as Image"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className="macos-ai-action-btn"
                  title={copiedId === active.id ? 'Copied to clipboard' : 'Copy response'}
                  onClick={() => void handleCopyText(active.response, active.id)}
                  aria-label="Copy Response"
                >
                  {copiedId === active.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  className="macos-ai-action-btn"
                  title={editingResponse ? 'Save edit' : 'Edit response'}
                  onClick={() => {
                    if (editingResponse) {
                      onUpdate(active.id, {
                        response: drafts[`response_${active.id}`] ?? active.response,
                        updatedAt: Date.now(),
                      });
                    }
                    setEditingResponse(!editingResponse);
                  }}
                  aria-label={editingResponse ? 'Save edit' : 'Edit response'}
                >
                  {editingResponse ? (
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
                    setDrafts((current) => ({ ...current, [active.id]: active.prompt }));
                    setOpenId(null);
                    onCloseJob(active.id);
                    requestAnimationFrame(() => setOpenId(active.id));
                    onSubmit(active, active.prompt);
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
                    onDelete(active.id);
                    onCloseJob(active.id);
                    setOpenId(null);
                  }}
                  aria-label="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
