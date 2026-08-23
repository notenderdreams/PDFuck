import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Check, Copy, Image as ImageIcon, Pencil, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
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
  onSelectAnnotation,
}) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingResponse, setEditingResponse] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const activeJobId = Object.keys(jobs).find((id) => annotations.some((annotation) => annotation.id === id));
  const activeId = activeJobId || openId;
  const active = annotations.find((annotation) => annotation.id === activeId);
  const job = active ? jobs[active.id] : undefined;

  useEffect(() => {
    if (activeJobId && openId !== activeJobId) {
      setOpenId(activeJobId);
    }
  }, [activeJobId, openId]);

  useEffect(() => {
    if (!active) return;
    setEditingResponse(false);
    setDrafts((current) => current[active.id] === undefined ? { ...current, [active.id]: active.prompt || DEFAULT_PROMPT } : current);
  }, [active?.id]);

  useEffect(() => {
    if (!activeId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (job?.phase === 'running') void onCancel(activeId);
        else onCloseJob(activeId);
        if (active && !active.response) {
          onDelete(active.id);
        }
        setOpenId(null);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [activeId, active, job?.phase, onCancel, onCloseJob, onDelete]);

  const popoverWidth = Math.min(480, Math.max(320, pageWidth - 20));
  const popoverStyle = active ? {
    width: `${popoverWidth}px`,
    left: `${Math.min(Math.max(8, (active.x + active.width) * pageWidth + 8), Math.max(8, pageWidth - popoverWidth - 8))}px`,
    top: `${Math.min(Math.max(8, active.y * pageHeight), Math.max(8, pageHeight - 300))}px`,
  } : undefined;

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
      {/* Floating AI Pin Buttons on Canvas */}
      {annotations.map((annotation) => {
        const state = jobs[annotation.id];
        const isRunning = state?.phase === 'running';

        return (
          <button
            key={annotation.id}
            type="button"
            aria-label={annotation.response ? 'Open AI explanation' : 'Open AI prompt'}
            onClick={(event) => { event.stopPropagation(); setOpenId(annotation.id); }}
            style={{ left: `${(annotation.x + annotation.width) * pageWidth - 14}px`, top: `${annotation.y * pageHeight - 14}px` }}
            className={`absolute pointer-events-auto macos-ai-pin flex items-center justify-center cursor-pointer ${
              isRunning ? 'macos-ai-pin-thinking' : ''
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        );
      })}

      {/* Animated macOS AI Popover Window */}
      {active && (
        <div
          ref={popoverRef}
          style={popoverStyle}
          role="dialog"
          aria-label="AI region explanation"
          className="macos-ai-popover absolute pointer-events-auto max-h-[min(76vh,560px)] overflow-y-auto p-4 flex flex-col gap-3"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-zinc-100 font-medium tracking-tight">AI Assistant</span>
              {job?.phase === 'running' && (
                <span className="text-[10px] font-medium text-blue-400 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                  Thinking…
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                className="macos-ai-action-btn w-6 h-6 rounded-md"
                onClick={() => {
                  if (job?.phase === 'running') void onCancel(active.id);
                  if (!active.response) {
                    onDelete(active.id);
                  }
                  setOpenId(null);
                  onCloseJob(active.id);
                }}
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body: Prompting or Thinking State */}
          {(!active.response || job) && (
            <>
              {job?.phase === 'running' ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Prompt</div>
                    <div className="text-xs font-medium text-zinc-200 bg-[var(--secondary)] p-2.5 rounded-lg border border-[var(--border)] leading-relaxed">
                      {drafts[active.id] ?? active.prompt ?? DEFAULT_PROMPT}
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
                        <span className="text-[10px] text-zinc-500 font-mono">Analyzing context</span>
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
                    <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => void onCancel(active.id)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400" htmlFor={`ai-prompt-${active.id}`}>
                    Ask AI about this region
                  </label>
                  <textarea
                    id={`ai-prompt-${active.id}`}
                    autoFocus
                    rows={3}
                    value={drafts[active.id] ?? active.prompt ?? DEFAULT_PROMPT}
                    onChange={(event) => setDrafts((current) => ({ ...current, [active.id]: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey || !event.shiftKey)) {
                        event.preventDefault();
                        const promptText = (drafts[active.id] ?? active.prompt ?? DEFAULT_PROMPT).trim();
                        if (promptText) {
                          onSubmit(active, promptText);
                        }
                      }
                    }}
                    placeholder="Type your question and press Enter..."
                    className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--input)] p-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 leading-relaxed font-sans transition-all"
                  />

                  {/* Quick Preset Prompt Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {QUICK_PROMPTS.map((qp) => (
                      <button
                        key={qp}
                        type="button"
                        onClick={() => setDrafts((current) => ({ ...current, [active.id]: qp }))}
                        className="text-[10.5px] px-2 py-0.5 rounded-md bg-[var(--secondary)] hover:bg-[var(--hover)] text-zinc-400 hover:text-zinc-200 border border-[var(--border)] transition-colors cursor-pointer"
                      >
                        {qp}
                      </button>
                    ))}
                  </div>

                  {job?.phase === 'error' && (
                    <div className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg" role="alert">
                      {job.message}
                    </div>
                  )}

                  <div className="flex justify-between items-center gap-1.5 pt-1">
                    <button
                      className="btn-ghost px-2.5 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => { onDelete(active.id); onCloseJob(active.id); setOpenId(null); }}
                    >
                      Delete
                    </button>
                    <button
                      className="btn-primary px-3.5 py-1.5 font-medium shadow-md"
                      disabled={!(drafts[active.id] ?? active.prompt).trim()}
                      onClick={() => onSubmit(active, drafts[active.id] ?? active.prompt)}
                    >
                      {job?.phase === 'error' ? 'Retry' : 'Explain Region'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Settled AI Response View */}
          {active.response && !job && (
            <div className="flex flex-col gap-3">
              <div data-ai-question="true" className="ai-question-section flex flex-col gap-1.5 bg-[var(--secondary)] p-2.5 rounded-lg border border-[var(--border)]">
                <div className="text-[9.5px] font-semibold uppercase tracking-wider text-zinc-400">Prompt</div>
                <div className="text-xs font-medium text-zinc-100">{active.prompt}</div>
              </div>

              {editingResponse ? (
                <textarea
                  autoFocus
                  rows={7}
                  value={drafts[`response_${active.id}`] ?? active.response}
                  onChange={(event) => setDrafts((current) => ({ ...current, [`response_${active.id}`]: event.target.value }))}
                  className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--input)] p-2.5 text-xs text-zinc-100 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                />
              ) : (
                <div className="p-1 max-h-[380px] overflow-y-auto">
                  <React.Suspense fallback={<div className="text-xs text-zinc-400 p-2">Rendering explanation…</div>}>
                    <AiResponseRenderer response={active.response} />
                  </React.Suspense>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex items-center justify-end pt-2.5 border-t border-[var(--border)]">
                <div className="flex items-center gap-1.5">
                  <button
                    className="macos-ai-action-btn"
                    title="Rasterize explanation into adjustable image"
                    onClick={() => void handleRasterizeResponse(active)}
                    aria-label="Rasterize as Image"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
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
                    className="macos-ai-action-btn"
                    title={editingResponse ? 'Save edit' : 'Edit response'}
                    onClick={() => {
                      if (editingResponse) onUpdate(active.id, { response: drafts[`response_${active.id}`] ?? active.response, updatedAt: Date.now() });
                      setEditingResponse(!editingResponse);
                    }}
                    aria-label={editingResponse ? 'Save edit' : 'Edit response'}
                  >
                    {editingResponse ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Pencil className="w-3.5 h-3.5" />}
                  </button>
                  <button
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
                    className="macos-ai-action-btn macos-ai-action-btn-danger"
                    title="Delete"
                    onClick={() => { onDelete(active.id); onCloseJob(active.id); setOpenId(null); }}
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
