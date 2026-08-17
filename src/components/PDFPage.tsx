import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { AnnotationCanvas } from './AnnotationCanvas';
import { ImageOverlay } from './ImageOverlay';
import type { Annotation, AttachedImageAnnotation, ReadingTheme, ToolType } from '../utils/types';

interface PDFPageProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  currentTheme: ReadingTheme;
  filterClass: string;
  customFilterStyle: React.CSSProperties;
  activeTool: ToolType;
  selectedColor: string;
  strokeWidth: number;
  opacity: number;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  onAddAnnotation: (ann: Annotation) => void;
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  onDeleteAnnotation: (id: string) => void;
  onImageDrop: (pageNumber: number, file: File) => void;
  onCursorMove?: (pageNumber: number, normalizedX: number, normalizedY: number) => void;
}

export const PDFPage: React.FC<PDFPageProps> = ({
  pdfDoc,
  pageNumber,
  scale,
  currentTheme,
  filterClass,
  customFilterStyle,
  activeTool,
  selectedColor,
  strokeWidth,
  opacity,
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onImageDrop,
  onCursorMove,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({
    width: 595,
    height: 842,
  });
  const [isRendered, setIsRendered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const renderTaskRef = useRef<unknown>(null);

  useEffect(() => {
    let isCancelled = false;

    const renderPage = async () => {
      try {
        const page: PDFPageProxy = await pdfDoc.getPage(pageNumber);
        if (isCancelled) return;

        const baseViewport = page.getViewport({ scale });
        setPageDimensions({
          width: Math.floor(baseViewport.width),
          height: Math.floor(baseViewport.height),
        });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const scaledViewport = page.getViewport({ scale: scale * dpr });

        canvas.width = Math.floor(scaledViewport.width);
        canvas.height = Math.floor(scaledViewport.height);
        canvas.style.width = `${Math.floor(baseViewport.width)}px`;
        canvas.style.height = `${Math.floor(baseViewport.height)}px`;

        if (renderTaskRef.current) {
          try {
            (renderTaskRef.current as { cancel: () => void }).cancel();
          } catch {}
        }

        const renderTask = page.render({
          canvasContext: ctx,
          viewport: scaledViewport,
        });
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (!isCancelled) {
          setIsRendered(true);
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== 'RenderingCancelledException') {
          console.warn(`Render error on page ${pageNumber}:`, err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          (renderTaskRef.current as { cancel: () => void }).cancel();
        } catch {}
      }
    };
  }, [pdfDoc, pageNumber, scale]);

  // Track cursor position for pasting at cursor location
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onCursorMove && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      onCursorMove(pageNumber, normX, normY);
    }
  };

  // Handle Drag & Drop of Images directly onto this page
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        onImageDrop(pageNumber, file);
      }
    }
  };

  const pageImages = annotations.filter(
    (a) => a.pageNumber === pageNumber && a.type === 'image'
  ) as AttachedImageAnnotation[];

  return (
    <div
      ref={containerRef}
      id={`pdf-page-${pageNumber}`}
      onMouseMove={handleMouseMove}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => onSelectAnnotation(null)}
      style={{
        width: `${pageDimensions.width}px`,
        height: `${pageDimensions.height}px`,
      }}
      className={`relative mx-auto my-6 bg-white shadow-[0_10px_35px_rgba(0,0,0,0.5)] rounded-sm transition-all duration-200 group ${
        isDragOver ? 'ring-4 ring-blue-500 scale-[1.01]' : ''
      }`}
    >
      {/* Visual Page Number Badge in Margin */}
      <div className="absolute -top-6 left-2 text-[10px] font-mono text-zinc-500 font-medium select-none">
        PAGE {pageNumber}
      </div>

      {/* Filtered Container for PDF Canvas & Color Inversion */}
      <div
        className={`w-full h-full relative overflow-hidden ${filterClass}`}
        style={customFilterStyle}
      >
        <canvas ref={canvasRef} className="block" />
      </div>

      {/* Annotation Canvas (SVG / Freehand / Highlights) */}
      <AnnotationCanvas
        pageNumber={pageNumber}
        pageWidth={pageDimensions.width}
        pageHeight={pageDimensions.height}
        activeTool={activeTool}
        selectedColor={selectedColor}
        strokeWidth={strokeWidth}
        opacity={opacity}
        annotations={annotations}
        onAddAnnotation={onAddAnnotation}
        onDeleteAnnotation={onDeleteAnnotation}
      />

      {/* Attached Images Layer */}
      {pageImages.map((imgAnn) => (
        <ImageOverlay
          key={imgAnn.id}
          annotation={imgAnn}
          isSelected={selectedAnnotationId === imgAnn.id}
          pageWidth={pageDimensions.width}
          pageHeight={pageDimensions.height}
          currentTheme={currentTheme}
          activeTool={activeTool}
          onSelect={onSelectAnnotation}
          onUpdate={onUpdateAnnotation}
          onDelete={onDeleteAnnotation}
        />
      ))}

      {/* Drop Image Overlay Visual Cue */}
      {isDragOver && (
        <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-xs border-2 border-dashed border-blue-400 flex flex-col items-center justify-center text-blue-200 z-50 rounded animate-fade-in pointer-events-none">
          <span className="text-base font-semibold">Drop Image to Attach</span>
          <span className="text-xs text-blue-300">Will be placed on Page {pageNumber}</span>
        </div>
      )}
    </div>
  );
};
