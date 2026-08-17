import React, { useState } from 'react';
import { X, Download, FileText, Code2, Image as ImageIcon, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Annotation } from '../utils/types';
import { exportAnnotatedPDF, savePdfFile, saveAnnotationsJson } from '../utils/pdfExporter';

interface ExportModalProps {
  isOpen: boolean;
  rawPdfBytes: Uint8Array | null;
  annotations: Annotation[];
  fileName: string;
  currentPage: number;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  rawPdfBytes,
  annotations,
  fileName,
  currentPage,
  onClose,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'],
      });
    } catch {}
  };

  // Export 1: Save Flattened / Baked PDF
  const handleExportBakedPdf = async () => {
    if (!rawPdfBytes) return;
    setIsExporting(true);
    setSuccessMessage(null);
    try {
      const outputBytes = await exportAnnotatedPDF(rawPdfBytes, annotations);
      const baseName = fileName.replace(/\.pdf$/i, '');
      const exportName = `${baseName}_annotated.pdf`;

      const result = await savePdfFile(outputBytes, exportName);
      if (result.success) {
        triggerConfetti();
        setSuccessMessage(`Successfully saved ${exportName}!`);
        setTimeout(() => {
          onClose();
          setSuccessMessage(null);
        }, 1800);
      }
    } catch (err: unknown) {
      console.error('Export PDF error:', err);
      alert('Failed to export PDF: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  // Export 2: Save Annotations Session JSON
  const handleExportJson = async () => {
    setIsExporting(true);
    setSuccessMessage(null);
    try {
      const baseName = fileName.replace(/\.pdf$/i, '');
      const exportName = `${baseName}_annotations.json`;
      const result = await saveAnnotationsJson(annotations, exportName);
      if (result.success) {
        triggerConfetti();
        setSuccessMessage(`Saved annotations session to ${exportName}!`);
        setTimeout(() => {
          onClose();
          setSuccessMessage(null);
        }, 1800);
      }
    } catch (err: unknown) {
      console.error('Export JSON error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Export 3: Export Current Page as PNG Image
  const handleExportPagePng = () => {
    try {
      const pageEl = document.getElementById(`pdf-page-${currentPage}`);
      if (!pageEl) return;

      const canvas = pageEl.querySelector('canvas');
      if (!canvas) return;

      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${fileName.replace(/\.pdf$/i, '')}_page_${currentPage}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      triggerConfetti();
      setSuccessMessage(`Exported Page ${currentPage} as PNG image!`);
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 1800);
    } catch (e) {
      console.error('Failed to export PNG:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md double-bezel bg-[#121216]/95 border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-400" />
              <span>Save & Export Document</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Save your highlights, attached images, and drawings
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-slide-down">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* Export Options */}
        <div className="flex flex-col gap-2.5">
          {/* Option 1: Flattened PDF */}
          <button
            onClick={handleExportBakedPdf}
            disabled={isExporting || !rawPdfBytes}
            className="p-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-left flex items-center justify-between group transition-all disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white group-hover:text-blue-300">
                  Save Modified PDF Document
                </span>
                <span className="text-[10px] text-zinc-400 leading-tight">
                  Bakes all {annotations.length} highlights, images & drawings into a permanent PDF file
                </span>
              </div>
            </div>
            {isExporting ? (
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            ) : (
              <Download className="w-4 h-4 text-blue-400 group-hover:translate-y-0.5 transition-transform" />
            )}
          </button>

          {/* Option 2: Annotations JSON */}
          <button
            onClick={handleExportJson}
            disabled={isExporting}
            className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 text-left flex items-center justify-between group transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Code2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white group-hover:text-purple-300">
                  Save Annotations Session (.json)
                </span>
                <span className="text-[10px] text-zinc-400 leading-tight">
                  Lightweight file to backup and restore your editable annotations anytime
                </span>
              </div>
            </div>
            <Download className="w-4 h-4 text-zinc-400 group-hover:translate-y-0.5 transition-transform" />
          </button>

          {/* Option 3: Page PNG */}
          <button
            onClick={handleExportPagePng}
            disabled={isExporting}
            className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 text-left flex items-center justify-between group transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white group-hover:text-emerald-300">
                  Export Page {currentPage} as PNG Image
                </span>
                <span className="text-[10px] text-zinc-400 leading-tight">
                  High-resolution rendered snapshot of the current page
                </span>
              </div>
            </div>
            <Download className="w-4 h-4 text-zinc-400 group-hover:translate-y-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
