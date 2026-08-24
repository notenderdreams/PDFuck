import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { TextLayer } from 'pdfjs-dist';
import { AnnotationCanvas } from './AnnotationCanvas';
import { ImageOverlay } from './ImageOverlay';
import { TextNoteOverlay } from './TextNoteOverlay';
import { AiExplanationOverlay } from './AiExplanationOverlay';
import { PageContextMenu } from './PageContextMenu';
import type { AiJobState } from '../hooks/useAiExplanations';
import { usesInvertedColorSpace } from '../utils/readingTheme';
import 'pdfjs-dist/web/pdf_viewer.css';
import type {
  Annotation,
  AttachedImageAnnotation,
  AiExplanationAnnotation,
  TextNoteAnnotation,
  ReadingTheme,
  ToolType,
} from '../utils/types';

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
  onCaptureSnippet?: (pageNumber: number, rect: { x: number; y: number; width: number; height: number }) => void;
  aiJobs: Record<string, AiJobState>;
  onAiBoxCreated: (annotationId: string) => void;
  onSubmitAi: (annotation: AiExplanationAnnotation, prompt: string) => void;
  onCancelAi: (annotationId: string) => void;
  onCloseAi: (annotationId: string) => void;
  onDeletePage: (pageNumber: number) => void;
  onCopyPageText: (pageNumber: number) => void;
  onCopyPageImage: (pageNumber: number) => void;
  onAskAiAboutPage: (pageNumber: number) => void;
  isFlush?: boolean;
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
  onCaptureSnippet,
  aiJobs,
  onAiBoxCreated,
  onSubmitAi,
  onCancelAi,
  onCloseAi,
  onDeletePage,
  onCopyPageText,
  onCopyPageImage,
  onAskAiAboutPage,
  isFlush = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({
    width: 595,
    height: 842,
  });
  const [isRendered, setIsRendered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
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
        if (isCancelled) return;
        setIsRendered(true);

        // Render Selectable Text Layer
        const textContent = await page.getTextContent();
        if (isCancelled) return;

        const textLayerDiv = textLayerRef.current;
        if (textLayerDiv) {
          textLayerDiv.innerHTML = '';
          textLayerDiv.style.setProperty('--scale-factor', `${scale}`);

          const textLayer = new TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: baseViewport,
          });

          await textLayer.render();
        }
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name !== 'RenderingCancelledException') {
          console.error(`Page ${pageNumber} render error:`, err);
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

  // Track cursor coordinates across the page
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !onCursorMove) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = Math.max(0, Math.min((e.clientX - rect.left) / pageDimensions.width, 1));
    const ny = Math.max(0, Math.min((e.clientY - rect.top) / pageDimensions.height, 1));
    onCursorMove(pageNumber, nx, ny);
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

  const pageTextNotes = annotations.filter(
    (a) => a.pageNumber === pageNumber && a.type === 'text-note'
  ) as TextNoteAnnotation[];

  const pageAiExplanations = annotations.filter(
    (a) => a.pageNumber === pageNumber && a.type === 'ai-explanation'
  ) as AiExplanationAnnotation[];

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 224;
    const menuHeight = 150;
    setContextMenuPosition({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    });
  };

  return (
    <div
      ref={containerRef}
      id={`pdf-page-${pageNumber}`}
      data-pdf-page-number={pageNumber}
      onMouseMove={handleMouseMove}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
      onClick={() => onSelectAnnotation(null)}
      style={{
        width: `${pageDimensions.width}px`,
        height: `${pageDimensions.height}px`,
      }}
      className={`relative mx-auto ${isFlush ? 'my-1' : 'my-4'} bg-white shadow-[0_1px_8px_rgba(0,0,0,0.22),0_1px_2px_rgba(0,0,0,0.14)] rounded-xs transition-all duration-150 group ${
        isDragOver ? 'ring-2 ring-[#0080f0] scale-[1.01]' : ''
      }`}
    >
      {contextMenuPosition && (
        <PageContextMenu
          position={contextMenuPosition}
          onClose={() => setContextMenuPosition(null)}
          onDeletePage={() => onDeletePage(pageNumber)}
          onCopyPageText={() => onCopyPageText(pageNumber)}
          onCopyPageImage={() => onCopyPageImage(pageNumber)}
          onAskAi={() => onAskAiAboutPage(pageNumber)}
        />
      )}
      {/* Visual Page Number Badge in Margin */}
      {!isFlush && (
        <div className="absolute -top-5 left-1 text-[10px] font-mono text-zinc-500 font-medium select-none tracking-wider">
          PAGE {pageNumber}
        </div>
      )}

      {/* Filtered Container for PDF Canvas & Color Inversion */}
      <div
        data-pdf-canvas-layer
        className={`w-full h-full relative overflow-hidden ${filterClass}`}
        style={customFilterStyle}
      >
        {/* Rendered PDF Raster Canvas */}
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* Keep selection feedback outside page filters so it stays visibly blue in every reading theme. */}
      <div
        ref={textLayerRef}
        data-pdf-text-layer
        className={`textLayer absolute inset-0 overflow-hidden leading-none z-10 ${
          activeTool === 'select'
            ? 'select-text pointer-events-auto cursor-text'
            : 'select-none pointer-events-none'
        }`}
        style={{
          width: `${pageDimensions.width}px`,
          height: `${pageDimensions.height}px`,
        }}
      />

      {/* Annotation Canvas (SVG / Freehand / Highlights / Note Creator) */}
      <AnnotationCanvas
        pageNumber={pageNumber}
        pageWidth={pageDimensions.width}
        pageHeight={pageDimensions.height}
        activeTool={activeTool}
        selectedColor={selectedColor}
        isInvertedColorMode={usesInvertedColorSpace(currentTheme)}
        strokeWidth={strokeWidth}
        opacity={opacity}
        annotations={annotations}
        selectedAnnotationId={selectedAnnotationId}
        onSelectAnnotation={onSelectAnnotation}
        onUpdateAnnotation={onUpdateAnnotation}
        onAddAnnotation={onAddAnnotation}
        onDeleteAnnotation={onDeleteAnnotation}
        onCaptureSnippet={onCaptureSnippet}
        onAiBoxCreated={onAiBoxCreated}
      />

      <AiExplanationOverlay
        pdfDoc={pdfDoc}
        pageWidth={pageDimensions.width}
        pageHeight={pageDimensions.height}
        annotations={pageAiExplanations}
        jobs={aiJobs}
        onSubmit={onSubmitAi}
        onCancel={onCancelAi}
        onCloseJob={onCloseAi}
        onUpdate={onUpdateAnnotation}
        onDelete={onDeleteAnnotation}
        onAddAnnotation={onAddAnnotation}
        selectedAnnotationId={selectedAnnotationId}
        onSelectAnnotation={onSelectAnnotation}
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

      {/* Interactive Text Notes Layer */}
      {pageTextNotes.map((noteAnn) => (
        <TextNoteOverlay
          key={noteAnn.id}
          annotation={noteAnn}
          isSelected={selectedAnnotationId === noteAnn.id}
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
        <div className="absolute inset-0 bg-[#0080f0]/20 backdrop-blur-xs border-2 border-dashed border-[#0080f0] flex flex-col items-center justify-center text-blue-200 z-50 rounded animate-fade-in pointer-events-none">
          <span className="text-sm font-semibold text-white">Drop Image to Attach</span>
          <span className="text-xs text-blue-200">Will be placed on Page {pageNumber}</span>
        </div>
      )}
    </div>
  );
};
