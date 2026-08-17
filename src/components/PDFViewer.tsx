import React, { useRef, useEffect, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PDFPage } from './PDFPage';
import { ChevronLeft, ChevronRight, UploadCloud, Sparkles } from 'lucide-react';
import type { Annotation, ReadingTheme, ToolType, ViewMode } from '../utils/types';

interface PDFViewerProps {
  pdfDoc: PDFDocumentProxy | null;
  rawPdfBytes: Uint8Array | null;
  currentPage: number;
  numPages: number;
  zoom: number;
  viewMode: ViewMode;
  currentTheme: ReadingTheme;
  filterClass: string;
  customFilterStyle: React.CSSProperties;
  activeTool: ToolType;
  selectedColor: string;
  strokeWidth: number;
  opacity: number;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  onPageChange: (newPage: number) => void;
  onSelectAnnotation: (id: string | null) => void;
  onAddAnnotation: (ann: Annotation) => void;
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  onDeleteAnnotation: (id: string) => void;
  onImageDrop: (pageNumber: number, file: File) => void;
  onPdfFileDrop: (file: File) => void;
  onOpenPdfClick: () => void;
  onLoadSampleClick: () => void;
  onCursorMove?: (pageNumber: number, normalizedX: number, normalizedY: number) => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfDoc,
  currentPage,
  numPages,
  zoom,
  viewMode,
  currentTheme,
  filterClass,
  customFilterStyle,
  activeTool,
  selectedColor,
  strokeWidth,
  opacity,
  annotations,
  selectedAnnotationId,
  onPageChange,
  onSelectAnnotation,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onImageDrop,
  onPdfFileDrop,
  onOpenPdfClick,
  onLoadSampleClick,
  onCursorMove,
}) => {
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const [isViewerDraggingFile, setIsViewerDraggingFile] = React.useState(false);

  // Track page scroll in continuous mode using IntersectionObserver
  useEffect(() => {
    if (viewMode !== 'continuous' || !pdfDoc) return;

    const container = viewerContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let mostVisiblePage = currentPage;

        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            const pageNum = parseInt(entry.target.id.replace('pdf-page-', ''), 10);
            if (!isNaN(pageNum)) {
              mostVisiblePage = pageNum;
            }
          }
        });

        if (mostVisiblePage !== currentPage && maxRatio > 0.3) {
          onPageChange(mostVisiblePage);
        }
      },
      {
        root: container,
        threshold: [0.1, 0.3, 0.5, 0.8],
      }
    );

    const pageElements = container.querySelectorAll('[id^="pdf-page-"]');
    pageElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [viewMode, pdfDoc, zoom]);

  // Handle Drag & Drop of PDF onto main empty viewport
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsViewerDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsViewerDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsViewerDraggingFile(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
        onPdfFileDrop(file);
      } else if (file.type.startsWith('image/') && numPages > 0) {
        onImageDrop(currentPage, file);
      }
    }
  };

  // If no PDF is loaded, show welcoming Hero drop zone
  if (!pdfDoc) {
    return (
      <main
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="flex-1 flex flex-col items-center justify-center p-6 bg-[#09090b] relative overflow-hidden"
      >
        {/* Subtle Background Glow */}
        <div className="absolute w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none -top-48 -left-48" />
        <div className="absolute w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none -bottom-48 -right-48" />

        <div className="max-w-md w-full double-bezel p-8 rounded-3xl text-center flex flex-col items-center gap-6 relative z-10 animate-slide-up">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/15 flex items-center justify-center shadow-lg">
            <UploadCloud className="w-8 h-8 text-blue-400" />
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Open or Drop a PDF Document
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Experience silky 120Hz smooth reading, OLED dark invert, translucent highlights, image attachments & native PDF export.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            <button
              onClick={onOpenPdfClick}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/25 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Browse PDF File</span>
            </button>
            <button
              onClick={onLoadSampleClick}
              className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 hover:text-white text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Load Sample Doc</span>
            </button>
          </div>

          <div className="text-[11px] text-zinc-500 font-mono">
            Drag & drop any .pdf file anywhere into the window
          </div>
        </div>
      </main>
    );
  }

  // Render pages according to viewMode
  return (
    <main
      ref={viewerContainerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 overflow-y-auto overflow-x-auto bg-[#09090b] relative flex flex-col items-center p-4 scroll-smooth"
    >
      {/* Dragging file overlay cue */}
      {isViewerDraggingFile && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white pointer-events-none animate-fade-in">
          <UploadCloud className="w-16 h-16 text-blue-400 animate-bounce mb-4" />
          <h3 className="text-xl font-bold">Drop PDF or Image to Open / Attach</h3>
        </div>
      )}

      {/* CONTINUOUS VIEW MODE */}
      {viewMode === 'continuous' && (
        <div className="flex flex-col items-center gap-8 pb-32">
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <PDFPage
              key={pageNum}
              pdfDoc={pdfDoc}
              pageNumber={pageNum}
              scale={zoom}
              currentTheme={currentTheme}
              filterClass={filterClass}
              customFilterStyle={customFilterStyle}
              activeTool={activeTool}
              selectedColor={selectedColor}
              strokeWidth={strokeWidth}
              opacity={opacity}
              annotations={annotations}
              selectedAnnotationId={selectedAnnotationId}
              onSelectAnnotation={onSelectAnnotation}
              onAddAnnotation={onAddAnnotation}
              onUpdateAnnotation={onUpdateAnnotation}
              onDeleteAnnotation={onDeleteAnnotation}
              onImageDrop={onImageDrop}
              onCursorMove={onCursorMove}
            />
          ))}
        </div>
      )}

      {/* SINGLE PAGE VIEW MODE */}
      {viewMode === 'single' && (
        <div className="flex flex-col items-center justify-center min-h-full pb-24 relative">
          <PDFPage
            pdfDoc={pdfDoc}
            pageNumber={currentPage}
            scale={zoom}
            currentTheme={currentTheme}
            filterClass={filterClass}
            customFilterStyle={customFilterStyle}
            activeTool={activeTool}
            selectedColor={selectedColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            annotations={annotations}
            selectedAnnotationId={selectedAnnotationId}
            onSelectAnnotation={onSelectAnnotation}
            onAddAnnotation={onAddAnnotation}
            onUpdateAnnotation={onUpdateAnnotation}
            onDeleteAnnotation={onDeleteAnnotation}
            onImageDrop={onImageDrop}
            onCursorMove={onCursorMove}
          />

          {/* Floating Next/Prev Page Buttons */}
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs text-zinc-300 z-30">
            <button
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous Page (Left Arrow / K)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono">
              {currentPage} / {numPages}
            </span>
            <button
              disabled={currentPage >= numPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next Page (Right Arrow / J)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TWO-PAGE SPREAD VIEW MODE */}
      {viewMode === 'spread' && (
        <div className="flex flex-col items-center justify-center min-h-full pb-24 relative">
          <div className="flex items-start justify-center gap-6">
            {/* Left Page */}
            <PDFPage
              pdfDoc={pdfDoc}
              pageNumber={currentPage % 2 === 0 ? currentPage - 1 : currentPage}
              scale={zoom * 0.85}
              currentTheme={currentTheme}
              filterClass={filterClass}
              customFilterStyle={customFilterStyle}
              activeTool={activeTool}
              selectedColor={selectedColor}
              strokeWidth={strokeWidth}
              opacity={opacity}
              annotations={annotations}
              selectedAnnotationId={selectedAnnotationId}
              onSelectAnnotation={onSelectAnnotation}
              onAddAnnotation={onAddAnnotation}
              onUpdateAnnotation={onUpdateAnnotation}
              onDeleteAnnotation={onDeleteAnnotation}
              onImageDrop={onImageDrop}
              onCursorMove={onCursorMove}
            />

            {/* Right Page (if exists) */}
            {(currentPage % 2 === 0 ? currentPage : currentPage + 1) <= numPages && (
              <PDFPage
                pdfDoc={pdfDoc}
                pageNumber={currentPage % 2 === 0 ? currentPage : currentPage + 1}
                scale={zoom * 0.85}
                currentTheme={currentTheme}
                filterClass={filterClass}
                customFilterStyle={customFilterStyle}
                activeTool={activeTool}
                selectedColor={selectedColor}
                strokeWidth={strokeWidth}
                opacity={opacity}
                annotations={annotations}
                selectedAnnotationId={selectedAnnotationId}
                onSelectAnnotation={onSelectAnnotation}
                onAddAnnotation={onAddAnnotation}
                onUpdateAnnotation={onUpdateAnnotation}
                onDeleteAnnotation={onDeleteAnnotation}
                onImageDrop={onImageDrop}
                onCursorMove={onCursorMove}
              />
            )}
          </div>

          {/* Floating Next/Prev Pair */}
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs text-zinc-300 z-30">
            <button
              disabled={currentPage <= 2}
              onClick={() => onPageChange(Math.max(1, currentPage - 2))}
              className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous Spread"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono">
              Spread {Math.ceil(currentPage / 2)} of {Math.ceil(numPages / 2)}
            </span>
            <button
              disabled={currentPage >= numPages - 1}
              onClick={() => onPageChange(Math.min(numPages, currentPage + 2))}
              className="p-1 rounded-full hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next Spread"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
