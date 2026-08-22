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

  const popoverWidth = Math.min(460, Math.max(300, pageWidth - 16));
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

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      {annotations.map((annotation) => {
        const state = jobs[annotation.id];
        return (
          <button
            key={annotation.id}
            type="button"
            aria-label={annotation.response ? 'Open AI explanation' : 'Open AI prompt'}
            onClick={(event) => { event.stopPropagation(); setOpenId(annotation.id); }}
            style={{ left: `${(annotation.x + annotation.width) * pageWidth - 12}px`, top: `${annotation.y * pageHeight - 12}px` }}
            className="absolute pointer-events-auto w-6 h-6 rounded-md bg-blue-600 text-white shadow-lg border border-white/30 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <Sparkles className={`w-3.5 h-3.5 ${state?.phase === 'running' ? 'animate-pulse' : ''}`} />
          </button>
        );
      })}

      {active && (
        <div
          ref={popoverRef}
          style={popoverStyle}
          role="dialog"
          aria-label="AI region explanation"
          className="absolute pointer-events-auto max-h-[min(72vh,540px)] overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--popover)] text-[var(--foreground)] shadow-2xl p-3.5 flex flex-col gap-2.5"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles className={`w-3.5 h-3.5 text-blue-500 ${job?.phase === 'running' ? 'animate-pulse' : ''}`} />
              <span>Codex explanation</span>
              {job?.phase === 'running' && (
                <span className="text-[10px] font-medium text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full animate-pulse">
                  Thinking…
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              {active.response && !job && (
                <button
                  className="btn-icon w-6 h-6"
                  title="Rasterize explanation into adjustable image"
                  onClick={() => void handleRasterizeResponse(active)}
                  aria-label="Rasterize explanation"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                className="btn-icon w-6 h-6"
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

          {(!active.response || job) && (
            <>
              {job?.phase === 'running' ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Question</div>
                    <div className="text-xs font-medium text-[var(--foreground)] bg-[var(--secondary)] p-2 rounded-md border border-[var(--border-subtle)] leading-relaxed">
                      {drafts[active.id] ?? active.prompt ?? DEFAULT_PROMPT}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 py-3 px-3 rounded-md bg-[var(--input)] border border-[var(--border-subtle)]">
                    <Sparkles className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-[var(--foreground)]">Thinking…</span>
                      <span className="text-[11px] text-[var(--muted-foreground)]">Analyzing selected document region</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-1.5 pt-0.5">
                    <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => void onCancel(active.id)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <label className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]" htmlFor={`ai-prompt-${active.id}`}>Question</label>
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
                    className="w-full resize-none rounded-md border border-[var(--border-subtle)] bg-[var(--input)] p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                  />
                  {job?.phase === 'error' && <div className="text-[11px] text-amber-500" role="alert">{job.message}</div>}
                  <div className="flex justify-between items-center gap-1.5">
                    <button className="btn-ghost px-2 py-1.5 text-red-500" onClick={() => { onDelete(active.id); onCloseJob(active.id); setOpenId(null); }}>Delete</button>
                    <button className="btn-primary px-2.5 py-1.5" disabled={!(drafts[active.id] ?? active.prompt).trim()} onClick={() => onSubmit(active, drafts[active.id] ?? active.prompt)}>{job?.phase === 'error' ? 'Retry' : 'Explain'}</button>
                  </div>
                </>
              )}
            </>
          )}

          {active.response && !job && (
            <>
              <div data-ai-question="true" className="ai-question-section flex flex-col gap-1">
                <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Question</div>
                <div className="text-xs font-medium">{active.prompt}</div>
                <div className="h-px bg-[var(--border-subtle)]" />
              </div>
              {editingResponse ? (
                <textarea autoFocus rows={7} value={drafts[`response_${active.id}`] ?? active.response} onChange={(event) => setDrafts((current) => ({ ...current, [`response_${active.id}`]: event.target.value }))} className="w-full resize-y rounded-md border border-[var(--border-subtle)] bg-[var(--input)] p-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500" />
              ) : (
                <React.Suspense fallback={<div className="text-xs text-[var(--muted-foreground)]">Rendering explanation…</div>}>
                  <AiResponseRenderer response={active.response} />
                </React.Suspense>
              )}
              <div className="flex items-center justify-end gap-1">
                <button
                  className="btn-icon"
                  title="Rasterize explanation into adjustable image"
                  onClick={() => void handleRasterizeResponse(active)}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                </button>
                <button className="btn-icon" title="Copy response" onClick={() => void navigator.clipboard.writeText(active.response)}><Copy className="w-3.5 h-3.5" /></button>
                <button className="btn-icon" title={editingResponse ? 'Save edit' : 'Edit response'} onClick={() => { if (editingResponse) onUpdate(active.id, { response: drafts[`response_${active.id}`] ?? active.response, updatedAt: Date.now() }); setEditingResponse(!editingResponse); }}>{editingResponse ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}</button>
                <button className="btn-icon" title="Retry" onClick={() => { setDrafts((current) => ({ ...current, [active.id]: active.prompt })); setOpenId(null); onCloseJob(active.id); requestAnimationFrame(() => setOpenId(active.id)); onSubmit(active, active.prompt); }}><RotateCcw className="w-3.5 h-3.5" /></button>
                <button className="btn-icon text-red-500" title="Delete" onClick={() => { onDelete(active.id); onCloseJob(active.id); setOpenId(null); }}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
