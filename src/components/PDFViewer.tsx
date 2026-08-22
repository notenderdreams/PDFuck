import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PDFPage } from './PDFPage';
import { ChevronLeft, ChevronRight, UploadCloud } from 'lucide-react';
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
  onChangeZoom: (newZoom: number) => void;
  onCursorMove?: (pageNumber: number, normalizedX: number, normalizedY: number) => void;
  onCaptureSnippet?: (pageNumber: number, rect: { x: number; y: number; width: number; height: number }) => void;
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
  onChangeZoom,
  onCursorMove,
  onCaptureSnippet,
}) => {
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const [isViewerDraggingFile, setIsViewerDraggingFile] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

  // Track Spacebar for Space+Drag Panning (Hand Tool mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !e.repeat &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Initial center scroll position horizontally when document is ready
  useEffect(() => {
    if (pdfDoc && viewerContainerRef.current) {
      const container = viewerContainerRef.current;
      requestAnimationFrame(() => {
        const centerScrollLeft = (container.scrollWidth - container.clientWidth) / 2;
        if (centerScrollLeft > 0) {
          container.scrollLeft = centerScrollLeft;
        }

        // Scroll to currentPage if not page 1
        if (currentPage > 1) {
          const targetEl = document.getElementById(`pdf-page-${currentPage}`);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' });
          }
        }
      });
    }
  }, [pdfDoc, viewMode]);

  // Scroll to page when navigating via stepper or thumbnail
  const lastTargetPageRef = useRef<number>(currentPage);
  useEffect(() => {
    if (viewMode === 'continuous' && pdfDoc && currentPage > 0) {
      if (lastTargetPageRef.current === currentPage) return;
      lastTargetPageRef.current = currentPage;

      const pageEl = document.getElementById(`pdf-page-${currentPage}`);
      const container = viewerContainerRef.current;
      if (pageEl && container) {
        const rect = pageEl.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();
        if (rect.bottom < contRect.top || rect.top > contRect.bottom) {
          pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  }, [currentPage, pdfDoc, viewMode]);

  // Mouse Wheel & Trackpad Pinch-to-Zoom (Ctrl/Cmd + Wheel)
  useEffect(() => {
    const container = viewerContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Pinch on trackpad sets e.ctrlKey=true. Cmd/Ctrl + Mouse Wheel also sets ctrlKey/metaKey.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomDelta = -e.deltaY * 0.004;
        const newZoom = Math.min(3.5, Math.max(0.3, zoom + zoomDelta));
        onChangeZoom(Number(newZoom.toFixed(2)));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoom, onChangeZoom]);

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

  // Handle Mouse Down for Panning (Spacebar + Left Click, Middle Click, or Background Canvas Drag)
  const handleStartPan = (e: React.MouseEvent) => {
    const isMiddleClick = e.button === 1;
    const isSpaceDrag = e.button === 0 && isSpacePressed;
    const isBackgroundClick =
      e.button === 0 &&
      (e.target === viewerContainerRef.current ||
        (e.target as HTMLElement).classList.contains('canvas-background-layer'));

    if (isMiddleClick || isSpaceDrag || isBackgroundClick) {
      const container = viewerContainerRef.current;
      if (!container) return;
      e.preventDefault();

      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      };

      const handleMouseMove = (moveEvt: MouseEvent) => {
        if (!panStartRef.current || !container) return;
        const dx = moveEvt.clientX - panStartRef.current.x;
        const dy = moveEvt.clientY - panStartRef.current.y;
        container.scrollLeft = panStartRef.current.scrollLeft - dx;
        container.scrollTop = panStartRef.current.scrollTop - dy;
      };

      const handleMouseUp = () => {
        setIsPanning(false);
        panStartRef.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
  };

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
        className="flex-1 flex flex-col items-center justify-center p-6 bg-[#1c1c22] relative overflow-hidden"
      >
        <div className="max-w-md w-full p-7 rounded-xl bg-[#24242b] border border-[#383846] text-center flex flex-col items-center gap-5 relative z-10 shadow-2xl animate-slide-up">
          <div className="w-12 h-12 rounded-xl bg-[#2d2d36] border border-[#404050] flex items-center justify-center text-zinc-300">
            <UploadCloud className="w-6 h-6" />
          </div>

          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
              Open or Drop a PDF Document
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Fast, smooth PDF reading with mouse zoom/pan, dark invert, text selection & native export.
            </p>
          </div>

          <div className="w-full">
            <button
              onClick={onOpenPdfClick}
              className="btn-primary w-full py-2.5"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Browse PDF File</span>
            </button>
          </div>

          <div className="text-[10px] text-zinc-500 font-mono">
            Drag & drop any .pdf file directly into the window
          </div>
        </div>
      </main>
    );
  }

  // Compute cursor style based on space/pan state
  const cursorStyle = isPanning
    ? 'cursor-grabbing'
    : isSpacePressed
    ? 'cursor-grab'
    : '';

  return (
    <main
      ref={viewerContainerRef}
      onMouseDown={handleStartPan}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 overflow-y-auto overflow-x-auto bg-[#1c1c22] relative select-none ${cursorStyle}`}
    >
      {/* Spacebar Pan Glass Interceptor (captures clicks everywhere over text/layers when space is held) */}
      {isSpacePressed && (
        <div
          onMouseDown={handleStartPan}
          className="fixed inset-0 z-40 cursor-grab active:cursor-grabbing bg-transparent"
        />
      )}

      {/* Dragging file overlay cue */}
      {isViewerDraggingFile && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white pointer-events-none animate-fade-in">
          <UploadCloud className="w-16 h-16 text-blue-400 animate-bounce mb-4" />
          <h3 className="text-xl font-bold">Drop PDF or Image to Open / Attach</h3>
        </div>
      )}

      {/* Infinite-Feel 2D Canvas Workspace Wrapper (allows 360° sidewise and vertical panning) */}
      <div className="canvas-background-layer w-max min-w-full min-h-full flex flex-col items-center justify-center px-[35vw] py-12 box-border">
        {/* CONTINUOUS VIEW MODE */}
        {viewMode === 'continuous' && (
          <div className="flex flex-col items-center gap-1 pb-32">
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
                onCaptureSnippet={onCaptureSnippet}
                isFlush
              />
            ))}
          </div>
        )}

        {/* SINGLE PAGE VIEW MODE */}
        {viewMode === 'single' && (
          <div className="flex flex-col items-center justify-center relative pb-24">
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
              onCaptureSnippet={onCaptureSnippet}
            />

            {/* Floating Next/Prev Page Buttons */}
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#24242b]/95 backdrop-blur-md px-3 py-1 rounded-md border border-[#383846] text-xs text-zinc-300 z-30 shadow-lg">
              <button
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="p-1 rounded hover:bg-[#34343f] disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous Page (Left Arrow / K)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-[11px]">
                {currentPage} / {numPages}
              </span>
              <button
                disabled={currentPage >= numPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="p-1 rounded hover:bg-[#34343f] disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next Page (Right Arrow / J)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TWO-PAGE SPREAD VIEW MODE */}
        {viewMode === 'spread' && (
          <div className="flex flex-col items-center justify-center relative pb-24">
            <div className="flex items-start justify-center gap-1">
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
                onCaptureSnippet={onCaptureSnippet}
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
                  onCaptureSnippet={onCaptureSnippet}
                />
              )}
            </div>

            {/* Floating Next/Prev Pair */}
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#24242b]/95 backdrop-blur-md px-3 py-1 rounded-md border border-[#383846] text-xs text-zinc-300 z-30 shadow-lg">
              <button
                disabled={currentPage <= 2}
                onClick={() => onPageChange(Math.max(1, currentPage - 2))}
                className="p-1 rounded hover:bg-[#34343f] disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous Spread"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-[11px]">
                Spread {Math.ceil(currentPage / 2)} of {Math.ceil(numPages / 2)}
              </span>
              <button
                disabled={currentPage >= numPages - 1}
                onClick={() => onPageChange(Math.min(numPages, currentPage + 2))}
                className="p-1 rounded hover:bg-[#34343f] disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next Spread"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
