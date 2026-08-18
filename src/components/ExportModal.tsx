import React, { useState } from 'react';
import { X, Download, FileText, Code2, Image as ImageIcon, CheckCircle2, Loader2 } from 'lucide-react';
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
        particleCount: 50,
        spread: 45,
        origin: { y: 0.7 },
        colors: ['#ffffff', '#a1a1aa', '#71717a'],
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
        setSuccessMessage(`Saved ${exportName}!`);
        setTimeout(() => {
          onClose();
          setSuccessMessage(null);
        }, 1500);
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
        setSuccessMessage(`Saved session to ${exportName}!`);
        setTimeout(() => {
          onClose();
          setSuccessMessage(null);
        }, 1500);
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
      setSuccessMessage(`Exported Page ${currentPage} as PNG!`);
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 1500);
    } catch (e) {
      console.error('Failed to export PNG:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in text-xs">
      <div className="w-full max-w-md bg-[#24242b] border border-[#383846] rounded-xl p-5 shadow-2xl flex flex-col gap-4 animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-zinc-100 tracking-tight flex items-center gap-1.5">
              <Download className="w-4 h-4 text-zinc-400" />
              <span>Save & Export Document</span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Export modified PDF with embedded annotations
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="btn-icon w-7 h-7"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="p-2.5 rounded-lg bg-[#1e1e24] border border-zinc-600 text-zinc-200 flex items-center gap-2 animate-slide-down">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* Export Options */}
        <div className="flex flex-col gap-2">
          {/* Option 1: Flattened PDF */}
          <button
            onClick={handleExportBakedPdf}
            disabled={isExporting || !rawPdfBytes}
            className="p-3 rounded-lg border border-zinc-600 bg-[#2d2d38] hover:bg-[#343442] text-left flex items-center justify-between group transition-all disabled:opacity-50"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-[#1e1e24] border border-[#3a3a46] flex items-center justify-center text-zinc-200">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-zinc-100 group-hover:text-white text-xs">
                  Save Modified PDF Document
                </span>
                <span className="text-[10px] text-zinc-400 leading-tight">
                  Bakes {annotations.length} highlights, images & drawings permanently
                </span>
              </div>
            </div>
            {isExporting ? (
              <Loader2 className="w-4 h-4 text-zinc-300 animate-spin" />
            ) : (
              <Download className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
            )}
          </button>

          {/* Option 2: Annotations JSON */}
          <button
            onClick={handleExportJson}
            disabled={isExporting}
            className="p-3 rounded-lg border border-[#363644] bg-[#1e1e24] hover:bg-[#2a2a34] text-left flex items-center justify-between group transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-[#282832] border border-[#383848] flex items-center justify-center text-zinc-400">
                <Code2 className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-zinc-300 group-hover:text-zinc-100 text-xs">
                  Save Annotations Session (.json)
                </span>
                <span className="text-[10px] text-zinc-400 leading-tight">
                  Editable backup manifest to reload later
                </span>
              </div>
            </div>
            <Download className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
          </button>

          {/* Option 3: Page PNG */}
          <button
            onClick={handleExportPagePng}
            disabled={isExporting}
            className="p-3 rounded-lg border border-[#363644] bg-[#1e1e24] hover:bg-[#2a2a34] text-left flex items-center justify-between group transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-[#282832] border border-[#383848] flex items-center justify-center text-zinc-400">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-zinc-300 group-hover:text-zinc-100 text-xs">
                  Export Page {currentPage} as PNG Image
                </span>
                <span className="text-[10px] text-zinc-400 leading-tight">
                  High-res raster snapshot of active page
                </span>
              </div>
            </div>
            <Download className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
};
