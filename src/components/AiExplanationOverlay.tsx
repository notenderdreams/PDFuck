import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Pencil, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import type { AiJobState } from '../hooks/useAiExplanations';
import type { AiExplanationAnnotation, Annotation } from '../utils/types';

const AiResponseRenderer = React.lazy(() =>
  import('./AiResponseRenderer').then((module) => ({ default: module.AiResponseRenderer }))
);

interface Props {
  pageWidth: number;
  pageHeight: number;
  annotations: AiExplanationAnnotation[];
  jobs: Record<string, AiJobState>;
  onSubmit: (annotation: AiExplanationAnnotation, prompt: string) => void;
  onCancel: (id: string) => void;
  onCloseJob: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Annotation>) => void;
  onDelete: (id: string) => void;
}

const DEFAULT_PROMPT = 'Explain this clearly and concisely';

export const AiExplanationOverlay: React.FC<Props> = ({ pageWidth, pageHeight, annotations, jobs, onSubmit, onCancel, onCloseJob, onUpdate, onDelete }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingResponse, setEditingResponse] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const activeJobId = Object.keys(jobs).find((id) => annotations.some((annotation) => annotation.id === id));
  const activeId = activeJobId || openId;
  const active = annotations.find((annotation) => annotation.id === activeId);
  const job = active ? jobs[active.id] : undefined;

  useEffect(() => {
    if (!active) return;
    setEditingResponse(false);
    setDrafts((current) => current[active.id] === undefined ? { ...current, [active.id]: active.prompt || DEFAULT_PROMPT } : current);
  }, [active?.id]);

  useEffect(() => {
    if (!activeId) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setOpenId(null);
        if (job?.phase !== 'running') onCloseJob(activeId);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (job?.phase === 'running') void onCancel(activeId);
        else onCloseJob(activeId);
        setOpenId(null);
      }
    };
    window.addEventListener('pointerdown', closeOnOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutside);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [activeId, job?.phase, onCancel, onCloseJob]);

  const popoverWidth = Math.min(460, Math.max(300, pageWidth - 16));
  const popoverStyle = active ? {
    width: `${popoverWidth}px`,
    left: `${Math.min(Math.max(8, (active.x + active.width) * pageWidth + 8), Math.max(8, pageWidth - popoverWidth - 8))}px`,
    top: `${Math.min(Math.max(8, active.y * pageHeight), Math.max(8, pageHeight - 300))}px`,
  } : undefined;

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
        <div ref={popoverRef} style={popoverStyle} role="dialog" aria-label="AI region explanation" className="absolute pointer-events-auto max-h-[min(72vh,540px)] overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--popover)] text-[var(--foreground)] shadow-2xl p-3.5 flex flex-col gap-2.5" onPointerDown={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold"><Sparkles className="w-3.5 h-3.5 text-blue-500" />Codex explanation</div>
            <button className="btn-icon w-6 h-6" onClick={() => { setOpenId(null); onCloseJob(active.id); }} aria-label="Close"><X className="w-3.5 h-3.5" /></button>
          </div>

          {(!active.response || job) && (
            <>
              <label className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]" htmlFor={`ai-prompt-${active.id}`}>Question</label>
              <textarea id={`ai-prompt-${active.id}`} autoFocus disabled={job?.phase === 'running'} rows={3} value={drafts[active.id] ?? active.prompt ?? DEFAULT_PROMPT} onChange={(event) => setDrafts((current) => ({ ...current, [active.id]: event.target.value }))} className="w-full resize-none rounded-md border border-[var(--border-subtle)] bg-[var(--input)] p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {job?.phase === 'error' && <div className="text-[11px] text-amber-500" role="alert">{job.message}</div>}
              <div className="flex justify-between gap-1.5">
                <button className="btn-ghost px-2 py-1.5 text-red-500" onClick={() => { if (job?.phase === 'running') void onCancel(active.id); onDelete(active.id); onCloseJob(active.id); setOpenId(null); }}>Delete</button>
                {job?.phase === 'running' ? (
                  <button className="btn-secondary px-2.5 py-1.5" onClick={() => void onCancel(active.id)}>Cancel</button>
                ) : (
                  <button className="btn-primary px-2.5 py-1.5" disabled={!(drafts[active.id] ?? active.prompt).trim()} onClick={() => onSubmit(active, drafts[active.id] ?? active.prompt)}>{job?.phase === 'error' ? 'Retry' : 'Explain'}</button>
                )}
              </div>
            </>
          )}

          {active.response && !job && (
            <>
              <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Question</div>
              <div className="text-xs font-medium">{active.prompt}</div>
              <div className="h-px bg-[var(--border-subtle)]" />
              {editingResponse ? (
                <textarea autoFocus rows={7} value={drafts[`response_${active.id}`] ?? active.response} onChange={(event) => setDrafts((current) => ({ ...current, [`response_${active.id}`]: event.target.value }))} className="w-full resize-y rounded-md border border-[var(--border-subtle)] bg-[var(--input)] p-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500" />
              ) : (
                <React.Suspense fallback={<div className="text-xs text-[var(--muted-foreground)]">Rendering explanation…</div>}>
                  <AiResponseRenderer response={active.response} />
                </React.Suspense>
              )}
              <div className="flex items-center justify-end gap-1">
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
