import React, { useRef, useState, useEffect } from 'react';
import { Trash2, X, Underline, Square, GripHorizontal } from 'lucide-react';
import type {
  Annotation,
  AiExplanationAnnotation,
  DrawingAnnotation,
  HighlightStyle,
  LineHighlightAnnotation,
  RectHighlightAnnotation,
  StrokePoint,
  TextHighlightAnnotation,
  TextNoteAnnotation,
  ToolType,
} from '../utils/types';
import { resolveHighlightOpacity, toggleHighlightStyle } from '../utils/highlightStyle';

interface AnnotationCanvasProps {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  activeTool: ToolType;
  selectedColor: string;
  isInvertedColorMode: boolean;
  strokeWidth: number;
  opacity: number;
  highlightStyle: HighlightStyle;
  annotations: Annotation[];
  selectedAnnotationId?: string | null;
  onSelectAnnotation?: (id: string | null) => void;
  onUpdateAnnotation?: (id: string, updates: Partial<Annotation>) => void;
  onChangeHighlightStyle?: (style: HighlightStyle) => void;
  onAddAnnotation: (ann: Annotation) => void;
  onDeleteAnnotation: (id: string) => void;
  onCaptureSnippet?: (pageNumber: number, rect: { x: number; y: number; width: number; height: number }) => void;
  onAiBoxCreated?: (annotationId: string) => void;
}

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  pageNumber,
  pageWidth,
  pageHeight,
  activeTool,
  selectedColor,
  isInvertedColorMode,
  strokeWidth,
  opacity,
  highlightStyle,
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
  onUpdateAnnotation,
  onChangeHighlightStyle,
  onAddAnnotation,
  onDeleteAnnotation,
  onCaptureSnippet,
  onAiBoxCreated,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Freehand Drawing State
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[] | null>(null);

  // Straight Line Highlight State
  const [lineStart, setLineStart] = useState<StrokePoint | null>(null);
  const [lineCurrent, setLineCurrent] = useState<StrokePoint | null>(null);

  // Rectangle Area Highlight State
  const [rectStart, setRectStart] = useState<StrokePoint | null>(null);
  const [rectCurrent, setRectCurrent] = useState<StrokePoint | null>(null);

  // Snippet / Crop Rectangle State
  const [snipStart, setSnipStart] = useState<StrokePoint | null>(null);
  const [snipCurrent, setSnipCurrent] = useState<StrokePoint | null>(null);
  const [aiStart, setAiStart] = useState<StrokePoint | null>(null);
  const [aiCurrent, setAiCurrent] = useState<StrokePoint | null>(null);

  // Text Note Input Popup State
  const [textInputPos, setTextInputPos] = useState<StrokePoint | null>(null);
  const [textInputValue, setTextInputValue] = useState<string>('');

  const isMouseDownRef = useRef(false);
  const isInteractingRef = useRef(false);
  const colorFilterClass = isInvertedColorMode ? 'annotation-color-preview-invert' : undefined;
  const rectHighlightStyle = highlightStyle === 'stroke' ? 'stroke' : 'box';

  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);

  const selectedHighlight = pageAnnotations.find(
    (a) =>
      a.id === selectedAnnotationId &&
      (a.type === 'highlight-rect' || a.type === 'highlight-text' || a.type === 'highlight-line')
  ) as RectHighlightAnnotation | TextHighlightAnnotation | LineHighlightAnnotation | undefined;

  let selectedHighlightPos = { x: 0, y: 0 };
  if (selectedHighlight) {
    if (selectedHighlight.type === 'highlight-rect') {
      selectedHighlightPos = {
        x: selectedHighlight.x * pageWidth,
        y: selectedHighlight.y * pageHeight,
      };
    } else if (selectedHighlight.type === 'highlight-text') {
      const minX = Math.min(...selectedHighlight.rects.map((r) => r.x));
      const minY = Math.min(...selectedHighlight.rects.map((r) => r.y));
      selectedHighlightPos = {
        x: minX * pageWidth,
        y: minY * pageHeight,
      };
    } else if (selectedHighlight.type === 'highlight-line') {
      const minX = Math.min(selectedHighlight.startX, selectedHighlight.endX);
      const minY = Math.min(selectedHighlight.startY, selectedHighlight.endY);
      selectedHighlightPos = {
        x: minX * pageWidth,
        y: minY * pageHeight,
      };
    }
  }

  const QUICK_HIGHLIGHT_COLORS = [
    '#facc15', // Yellow
    '#fbbf24', // Amber
    '#4ade80', // Green
    '#38bdf8', // Blue
    '#fb7185', // Coral
    '#c084fc', // Purple
    '#f87171', // Red
  ];

  // Flash feedback state after capturing a snippet
  const [capturedFlashRect, setCapturedFlashRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const textNoteTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Guarantee instant focus on text note creation
  useEffect(() => {
    if (textInputPos) {
      const focusTextarea = () => {
        if (textNoteTextareaRef.current) {
          textNoteTextareaRef.current.focus();
        }
      };
      focusTextarea();
      const t1 = setTimeout(focusTextarea, 20);
      const t2 = setTimeout(focusTextarea, 80);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [textInputPos]);

  // Convert pointer event coordinates to normalized 0..1 coordinates relative to page dimensions
  const getNormalizedCoords = (e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>): { x: number; y: number; px: number; py: number } => {
    if (!containerRef.current) return { x: 0, y: 0, px: 0, py: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const px = Math.max(0, Math.min(e.clientX - rect.left, pageWidth));
    const py = Math.max(0, Math.min(e.clientY - rect.top, pageHeight));
    return {
      x: px / pageWidth,
      y: py / pageHeight,
      px,
      py,
    };
  };

  // Handle moving / dragging of rectangle highlights via toolbar handle
  const isDraggingHighlightRef = useRef(false);

  const handleHighlightDragStart = (
    e: React.PointerEvent,
    rect: RectHighlightAnnotation
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    onSelectAnnotation?.(rect.id);

    isDraggingHighlightRef.current = true;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initialX = rect.x;
    const initialY = rect.y;
    const rectWidth = rect.width;
    const rectHeight = rect.height;

    const handlePointerMove = (moveEvt: PointerEvent) => {
      if (!isDraggingHighlightRef.current) return;
      const dx = (moveEvt.clientX - startClientX) / pageWidth;
      const dy = (moveEvt.clientY - startClientY) / pageHeight;

      const maxX = Math.max(0, 1 - rectWidth);
      const maxY = Math.max(0, 1 - rectHeight);

      const newX = Math.max(0, Math.min(initialX + dx, maxX));
      const newY = Math.max(0, Math.min(initialY + dy, maxY));

      onUpdateAnnotation?.(rect.id, { x: newX, y: newY });
    };

    const handlePointerUp = () => {
      isDraggingHighlightRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  // Handle resizing of rectangle highlights via bottom-right corner handle
  const isResizingHighlightRef = useRef(false);

  const handleHighlightResizeStart = (
    e: React.PointerEvent,
    rect: RectHighlightAnnotation
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    onSelectAnnotation?.(rect.id);

    isResizingHighlightRef.current = true;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initialX = rect.x;
    const initialY = rect.y;
    const initialWidth = rect.width;
    const initialHeight = rect.height;

    const handlePointerMove = (moveEvt: PointerEvent) => {
      if (!isResizingHighlightRef.current) return;
      const dx = (moveEvt.clientX - startClientX) / pageWidth;
      const dy = (moveEvt.clientY - startClientY) / pageHeight;

      const maxWidth = Math.max(0.01, 1 - initialX);
      const maxHeight = Math.max(0.005, 1 - initialY);

      const newWidth = Math.max(0.01, Math.min(initialWidth + dx, maxWidth));
      const newHeight = Math.max(0.005, Math.min(initialHeight + dy, maxHeight));

      onUpdateAnnotation?.(rect.id, { width: newWidth, height: newHeight });
    };

    const handlePointerUp = () => {
      isResizingHighlightRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  // Handle moving / dragging of straight line highlights
  const isDraggingLineRef = useRef(false);

  const handleLineDragStart = (
    e: React.PointerEvent,
    line: LineHighlightAnnotation
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    onSelectAnnotation?.(line.id);

    isDraggingLineRef.current = true;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initialStartX = line.startX;
    const initialStartY = line.startY;
    const initialEndX = line.endX;
    const initialEndY = line.endY;

    const handlePointerMove = (moveEvt: PointerEvent) => {
      if (!isDraggingLineRef.current) return;
      const dx = (moveEvt.clientX - startClientX) / pageWidth;
      const dy = (moveEvt.clientY - startClientY) / pageHeight;

      const minX = Math.min(initialStartX, initialEndX);
      const maxX = Math.max(initialStartX, initialEndX);
      const minY = Math.min(initialStartY, initialEndY);
      const maxY = Math.max(initialStartY, initialEndY);

      const clampedDx = Math.max(-minX, Math.min(dx, 1 - maxX));
      const clampedDy = Math.max(-minY, Math.min(dy, 1 - maxY));

      onUpdateAnnotation?.(line.id, {
        startX: initialStartX + clampedDx,
        startY: initialStartY + clampedDy,
        endX: initialEndX + clampedDx,
        endY: initialEndY + clampedDy,
      });
    };

    const handlePointerUp = () => {
      isDraggingLineRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  // Handle adjusting start or end endpoint of a straight line highlight
  const isDraggingEndpointRef = useRef(false);

  const handleLineEndpointDragStart = (
    e: React.PointerEvent,
    line: LineHighlightAnnotation,
    endpoint: 'start' | 'end'
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    onSelectAnnotation?.(line.id);

    isDraggingEndpointRef.current = true;

    const handlePointerMove = (moveEvt: PointerEvent) => {
      if (!isDraggingEndpointRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const px = Math.max(0, Math.min(moveEvt.clientX - rect.left, pageWidth));
      let py = Math.max(0, Math.min(moveEvt.clientY - rect.top, pageHeight));

      const otherY = endpoint === 'start' ? line.endY * pageHeight : line.startY * pageHeight;
      // Auto-snap horizontal if within 10px
      if (Math.abs(py - otherY) < 10) {
        py = otherY;
      }

      const nx = Math.max(0, Math.min(1, px / pageWidth));
      const ny = Math.max(0, Math.min(1, py / pageHeight));

      if (endpoint === 'start') {
        onUpdateAnnotation?.(line.id, { startX: nx, startY: ny });
      } else {
        onUpdateAnnotation?.(line.id, { endX: nx, endY: ny });
      }
    };

    const handlePointerUp = () => {
      isDraggingEndpointRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (activeTool === 'select' || activeTool === 'image' || activeTool === 'eraser') return;
    isMouseDownRef.current = true;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const { x, y } = getNormalizedCoords(e);

    if (activeTool === 'highlight-line') {
      isInteractingRef.current = true;
      setLineStart({ x, y });
      setLineCurrent({ x, y });
    } else if (activeTool === 'pen' || activeTool === 'highlight-pen') {
      isInteractingRef.current = true;
      setCurrentStroke([{ x, y }]);
    } else if (activeTool === 'highlight-rect') {
      isInteractingRef.current = true;
      setRectStart({ x, y });
      setRectCurrent({ x, y });
    } else if (activeTool === 'snip') {
      isInteractingRef.current = true;
      setSnipStart({ x, y });
      setSnipCurrent({ x, y });
    } else if (activeTool === 'ai-box') {
      isInteractingRef.current = true;
      setAiStart({ x, y });
      setAiCurrent({ x, y });
    } else if (activeTool === 'text') {
      setTextInputPos({ x, y });
      setTextInputValue('');
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const { x, y } = getNormalizedCoords(e);

    if (!isInteractingRef.current) return;

    if (activeTool === 'highlight-line') {
      let curX = x;
      let curY = y;
      if (lineStart) {
        // Auto-snap horizontal line if vertical difference is small (within 10px)
        if (Math.abs(y - lineStart.y) * pageHeight < 10) {
          curY = lineStart.y;
        }
      }
      setLineCurrent({ x: curX, y: curY });
    } else if (activeTool === 'pen' || activeTool === 'highlight-pen') {
      setCurrentStroke((prev) => (prev ? [...prev, { x, y }] : [{ x, y }]));
    } else if (activeTool === 'highlight-rect') {
      setRectCurrent({ x, y });
    } else if (activeTool === 'snip') {
      setSnipCurrent({ x, y });
    } else if (activeTool === 'ai-box') {
      setAiCurrent({ x, y });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    isMouseDownRef.current = false;

    if (!isInteractingRef.current) return;
    isInteractingRef.current = false;

    if (activeTool === 'highlight-line' && lineStart && lineCurrent) {
      let endX = lineCurrent.x;
      let endY = lineCurrent.y;
      if (Math.abs(endY - lineStart.y) * pageHeight < 10) {
        endY = lineStart.y;
      }
      const distPx = Math.hypot((endX - lineStart.x) * pageWidth, (endY - lineStart.y) * pageHeight);
      if (distPx > 6) {
        const newLine: LineHighlightAnnotation = {
          id: `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          pageNumber,
          type: 'highlight-line',
          startX: lineStart.x,
          startY: lineStart.y,
          endX,
          endY,
          color: selectedColor,
          strokeWidth: strokeWidth * 2.8,
          opacity: resolveHighlightOpacity(highlightStyle, opacity),
          style: highlightStyle === 'underline' ? 'underline' : 'highlight',
          createdAt: Date.now(),
        };
        onAddAnnotation(newLine);
      }
      setLineStart(null);
      setLineCurrent(null);
    } else if (
      (activeTool === 'pen' || activeTool === 'highlight-pen') &&
      currentStroke &&
      currentStroke.length > 1
    ) {
      const newDrawing: DrawingAnnotation = {
        id: `draw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        pageNumber,
        type: activeTool,
        points: currentStroke,
        color: selectedColor,
        strokeWidth: activeTool === 'highlight-pen' ? strokeWidth * 2.5 : strokeWidth,
        opacity: activeTool === 'highlight-pen' ? opacity : 1,
        createdAt: Date.now(),
      };
      onAddAnnotation(newDrawing);
      setCurrentStroke(null);
    } else if (activeTool === 'highlight-rect' && rectStart && rectCurrent) {
      const x = Math.min(rectStart.x, rectCurrent.x);
      const y = Math.min(rectStart.y, rectCurrent.y);
      const width = Math.abs(rectCurrent.x - rectStart.x);
      const height = Math.abs(rectCurrent.y - rectStart.y);

      if (width * pageWidth > 6 && height * pageHeight > 6) {
        const newRect: RectHighlightAnnotation = {
          id: `rect_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          pageNumber,
          type: 'highlight-rect',
          x,
          y,
          width,
          height,
          color: selectedColor,
          opacity: resolveHighlightOpacity(rectHighlightStyle, opacity),
          style: rectHighlightStyle,
          createdAt: Date.now(),
        };
        onAddAnnotation(newRect);
      }
      setRectStart(null);
      setRectCurrent(null);
    } else if (activeTool === 'snip' && snipStart && snipCurrent) {
      const x = Math.min(snipStart.x, snipCurrent.x);
      const y = Math.min(snipStart.y, snipCurrent.y);
      const width = Math.abs(snipCurrent.x - snipStart.x);
      const height = Math.abs(snipCurrent.y - snipStart.y);

      if (width * pageWidth > 6 && height * pageHeight > 6) {
        const captureRect = { x, y, width, height };
        setCapturedFlashRect(captureRect);
        setTimeout(() => setCapturedFlashRect(null), 800);
        onCaptureSnippet?.(pageNumber, captureRect);
      }
      setSnipStart(null);
      setSnipCurrent(null);
    } else if (activeTool === 'ai-box' && aiStart && aiCurrent) {
      const x = Math.min(aiStart.x, aiCurrent.x);
      const y = Math.min(aiStart.y, aiCurrent.y);
      const width = Math.abs(aiCurrent.x - aiStart.x);
      const height = Math.abs(aiCurrent.y - aiStart.y);
      if (width * pageWidth > 12 && height * pageHeight > 12) {
        const now = Date.now();
        const annotation: AiExplanationAnnotation = {
          id: `ai_box_${now}_${Math.random().toString(36).slice(2, 7)}`,
          pageNumber,
          type: 'ai-explanation',
          x,
          y,
          width,
          height,
          prompt: '',
          response: '',
          provider: 'codex',
          createdAt: now,
          updatedAt: now,
        };
        onAddAnnotation(annotation);
        onAiBoxCreated?.(annotation.id);
      }
      setAiStart(null);
      setAiCurrent(null);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}
    isMouseDownRef.current = false;
    isInteractingRef.current = false;
    setSnipStart(null);
    setSnipCurrent(null);
    setRectStart(null);
    setRectCurrent(null);
    setCurrentStroke(null);
    setLineStart(null);
    setLineCurrent(null);
    setAiStart(null);
    setAiCurrent(null);
  };

  const handleSaveTextNote = () => {
    if (textInputPos && textInputValue.trim()) {
      const newNote: TextNoteAnnotation = {
        id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        pageNumber,
        type: 'text-note',
        x: textInputPos.x,
        y: textInputPos.y,
        text: textInputValue.trim(),
        color: '#fef08a', // Default sticky yellow
        fontSize: 12,
        createdAt: Date.now(),
      };
      onAddAnnotation(newNote);
    }
    setTextInputPos(null);
    setTextInputValue('');
  };

  const pointsToSvgPath = (points: StrokePoint[]) => {
    if (points.length === 0) return '';
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * pageWidth} ${p.y * pageHeight}`)
      .join(' ');
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={`absolute inset-0 select-none touch-none ${
        activeTool === 'select' || activeTool === 'image' || activeTool === 'eraser'
          ? 'pointer-events-none'
          : 'cursor-crosshair pointer-events-auto'
      }`}
    >

      {/* 1. Highlight SVG Layer (Blends directly with PDF canvas underneath text) */}
      <svg
        data-pdf-highlight-layer
        className="w-full h-full absolute inset-0 z-[5] pointer-events-none"
        style={{
          width: `${pageWidth}px`,
          height: `${pageHeight}px`,
          mixBlendMode: isInvertedColorMode ? 'screen' : 'multiply',
        }}
      >
        {/* Render highlights created from selected PDF text */}
        {pageAnnotations
          .filter((a) => a.type === 'highlight-text' && a.style !== 'underline')
          .map((a) => {
            const textHighlight = a as TextHighlightAnnotation;
            return (
              <g key={`hl_${textHighlight.id}`}>
                {textHighlight.rects.map((rect, index) => (
                  <rect
                    key={`${textHighlight.id}_fill_${index}`}
                    className={colorFilterClass}
                    x={rect.x * pageWidth}
                    y={rect.y * pageHeight}
                    width={rect.width * pageWidth}
                    height={rect.height * pageHeight}
                    fill={textHighlight.color}
                    fillOpacity={textHighlight.opacity || 0.45}
                  />
                ))}
              </g>
            );
          })}

        {/* Render Filled Rect Highlights */}
        {pageAnnotations
          .filter((a) => a.type === 'highlight-rect' && (!a.style || a.style === 'box'))
          .map((a) => {
            const rect = a as RectHighlightAnnotation;
            return (
              <rect
                key={`hl_${rect.id}`}
                className={colorFilterClass || ''}
                x={rect.x * pageWidth}
                y={rect.y * pageHeight}
                width={rect.width * pageWidth}
                height={rect.height * pageHeight}
                fill={rect.color}
                fillOpacity={rect.opacity || 0.4}
              />
            );
          })}

        {/* Render Straight Line Highlights */}
        {pageAnnotations
          .filter((a) => a.type === 'highlight-line')
          .map((a) => {
            const line = a as LineHighlightAnnotation;
            return (
              <line
                key={`hl_${line.id}`}
                className={colorFilterClass}
                x1={line.startX * pageWidth}
                y1={line.startY * pageHeight}
                x2={line.endX * pageWidth}
                y2={line.endY * pageHeight}
                stroke={line.color}
                strokeWidth={line.style === 'underline' ? 2.5 : line.strokeWidth}
                strokeOpacity={line.style === 'underline' ? 1 : line.opacity}
                strokeLinecap={line.style === 'underline' ? 'round' : 'square'}
              />
            );
          })}

        {/* Render Freehand Highlight Pen */}
        {pageAnnotations
          .filter((a) => a.type === 'highlight-pen')
          .map((a) => {
            const draw = a as DrawingAnnotation;
            return (
              <path
                key={`hl_${draw.id}`}
                className={colorFilterClass}
                d={pointsToSvgPath(draw.points)}
                stroke={draw.color}
                strokeWidth={draw.strokeWidth}
                strokeOpacity={draw.opacity}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            );
          })}

        {/* Active Straight Line Highlight in progress */}
        {activeTool === 'highlight-line' && lineStart && lineCurrent && (
          <line
            className={colorFilterClass}
            x1={lineStart.x * pageWidth}
            y1={lineStart.y * pageHeight}
            x2={lineCurrent.x * pageWidth}
            y2={
              Math.abs(lineCurrent.y - lineStart.y) * pageHeight < 10
                ? lineStart.y * pageHeight
                : lineCurrent.y * pageHeight
            }
            stroke={selectedColor}
            strokeWidth={highlightStyle === 'underline' ? 2.5 : strokeWidth * 2.8}
            strokeOpacity={resolveHighlightOpacity(highlightStyle, opacity)}
            strokeLinecap={highlightStyle === 'underline' ? 'round' : 'square'}
          />
        )}

        {/* Active Freehand Highlight Pen in progress */}
        {activeTool === 'highlight-pen' && currentStroke && (
          <path
            className={colorFilterClass}
            d={pointsToSvgPath(currentStroke)}
            stroke={selectedColor}
            strokeWidth={strokeWidth * 2.5}
            strokeOpacity={opacity}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}

        {/* Active Rectangle Highlight in progress */}
        {activeTool === 'highlight-rect' && rectHighlightStyle === 'box' && rectStart && rectCurrent && (
          <rect
            className={colorFilterClass}
            x={Math.min(rectStart.x, rectCurrent.x) * pageWidth}
            y={Math.min(rectStart.y, rectCurrent.y) * pageHeight}
            width={Math.abs(rectCurrent.x - rectStart.x) * pageWidth}
            height={Math.abs(rectCurrent.y - rectStart.y) * pageHeight}
            fill={selectedColor}
            fillOpacity={opacity}
            stroke={selectedColor}
            strokeWidth={1}
          />
        )}
      </svg>

      {/* 2. Drawing, Strokes, Selection Outlines & Interactive Hit-Targets Layer */}
      <svg
        data-pdf-drawing-layer
        className="w-full h-full absolute inset-0 z-20 pointer-events-none"
        style={{ width: `${pageWidth}px`, height: `${pageHeight}px` }}
      >
        {/* Underlines for Text Highlights */}
        {pageAnnotations
          .filter((a) => a.type === 'highlight-text' && a.style === 'underline')
          .map((a) => {
            const textHighlight = a as TextHighlightAnnotation;
            return (
              <g key={`underline_${textHighlight.id}`}>
                {textHighlight.rects.map((rect, index) => (
                  <line
                    key={`${textHighlight.id}_ul_${index}`}
                    className={colorFilterClass}
                    x1={rect.x * pageWidth}
                    y1={(rect.y + rect.height) * pageHeight - 1.5}
                    x2={(rect.x + rect.width) * pageWidth}
                    y2={(rect.y + rect.height) * pageHeight - 1.5}
                    stroke={textHighlight.color}
                    strokeWidth={2.5}
                    strokeOpacity={1}
                    strokeLinecap="round"
                  />
                ))}
              </g>
            );
          })}

        {/* Outlines and Underlines for Rect Highlights */}
        {pageAnnotations
          .filter((a) => a.type === 'highlight-rect' && (a.style === 'stroke' || a.style === 'underline'))
          .map((a) => {
            const rect = a as RectHighlightAnnotation;
            if (rect.style === 'stroke') {
              return (
                <rect
                  key={`stroke_${rect.id}`}
                  className={colorFilterClass || ''}
                  x={rect.x * pageWidth}
                  y={rect.y * pageHeight}
                  width={rect.width * pageWidth}
                  height={rect.height * pageHeight}
                  fill="none"
                  stroke={rect.color}
                  strokeWidth={2.5}
                  strokeOpacity={1}
                />
              );
            }
            return (
              <line
                key={`underline_${rect.id}`}
                className={colorFilterClass}
                x1={rect.x * pageWidth}
                y1={(rect.y + rect.height) * pageHeight - 1.5}
                x2={(rect.x + rect.width) * pageWidth}
                y2={(rect.y + rect.height) * pageHeight - 1.5}
                stroke={rect.color}
                strokeWidth={2.5}
                strokeOpacity={1}
                strokeLinecap="round"
              />
            );
          })}

        {/* Active opaque stroke preview for new area highlights */}
        {activeTool === 'highlight-rect' && rectHighlightStyle === 'stroke' && rectStart && rectCurrent && (
          <rect
            className={colorFilterClass}
            x={Math.min(rectStart.x, rectCurrent.x) * pageWidth}
            y={Math.min(rectStart.y, rectCurrent.y) * pageHeight}
            width={Math.abs(rectCurrent.x - rectStart.x) * pageWidth}
            height={Math.abs(rectCurrent.y - rectStart.y) * pageHeight}
            fill="none"
            stroke={selectedColor}
            strokeWidth={2.5}
            strokeOpacity={1}
          />
        )}
        {/* Regular Pen Freehand Drawings */}
        {pageAnnotations
          .filter((a) => a.type === 'pen')
          .map((a) => {
            const draw = a as DrawingAnnotation;
            return (
              <path
                key={draw.id}
                className={colorFilterClass}
                d={pointsToSvgPath(draw.points)}
                stroke={draw.color}
                strokeWidth={draw.strokeWidth}
                strokeOpacity={1}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            );
          })}

        {/* Active Regular Pen Drawing in progress */}
        {activeTool === 'pen' && currentStroke && (
          <path
            className={colorFilterClass}
            d={pointsToSvgPath(currentStroke)}
            stroke={selectedColor}
            strokeWidth={strokeWidth}
            strokeOpacity={1}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}

        {/* AI regions remain outlined so document content stays readable */}
        {pageAnnotations
          .filter((a) => a.type === 'ai-explanation')
          .map((a) => {
            const box = a as AiExplanationAnnotation;
            return (
              <rect
                key={box.id}
                x={box.x * pageWidth}
                y={box.y * pageHeight}
                width={box.width * pageWidth}
                height={box.height * pageHeight}
                fill="rgba(59,130,246,0.05)"
                stroke="#3b82f6"
                strokeWidth={1.5}
              />
            );
          })}

        {/* Active Snip Rectangle in progress */}
        {activeTool === 'snip' && snipStart && snipCurrent && (
          <g>
            <rect
              x={Math.min(snipStart.x, snipCurrent.x) * pageWidth}
              y={Math.min(snipStart.y, snipCurrent.y) * pageHeight}
              width={Math.abs(snipCurrent.x - snipStart.x) * pageWidth}
              height={Math.abs(snipCurrent.y - snipStart.y) * pageHeight}
              fill="rgba(59, 130, 246, 0.15)"
              stroke="#3b82f6"
              strokeWidth={1}
            />
          </g>
        )}

        {/* Active AI Box in progress */}
        {activeTool === 'ai-box' && aiStart && aiCurrent && (
          <rect
            x={Math.min(aiStart.x, aiCurrent.x) * pageWidth}
            y={Math.min(aiStart.y, aiCurrent.y) * pageHeight}
            width={Math.abs(aiCurrent.x - aiStart.x) * pageWidth}
            height={Math.abs(aiCurrent.y - aiStart.y) * pageHeight}
            fill="rgba(59, 130, 246, 0.12)"
            stroke="#3b82f6"
            strokeWidth={2}
          />
        )}

        {/* Captured Flash Effect on Snippet Release */}
        {capturedFlashRect && (
          <rect
            x={capturedFlashRect.x * pageWidth}
            y={capturedFlashRect.y * pageHeight}
            width={capturedFlashRect.width * pageWidth}
            height={capturedFlashRect.height * pageHeight}
            fill="rgba(59, 130, 246, 0.25)"
            stroke="#60a5fa"
            strokeWidth={2}
            rx={3}
            className="animate-pulse"
          />
        )}

        {/* Interactive Hit Targets & Selection Feedback when activeTool === 'select' */}
        {/* 1. Hit targets and selection for Text Highlights */}
        {pageAnnotations
          .filter((a) => a.type === 'highlight-text')
          .map((a) => {
            const textHighlight = a as TextHighlightAnnotation;
            const isSelected = selectedAnnotationId === textHighlight.id;
            return (
              <g
                key={`hit_th_${textHighlight.id}`}
                className={activeTool === 'select' ? 'pointer-events-auto cursor-pointer' : undefined}
                onClick={(e) => {
                  if (activeTool === 'select') {
                    e.stopPropagation();
                    onSelectAnnotation?.(textHighlight.id);
                  }
                }}
              >
                {textHighlight.rects.map((rect, index) => (
                  <React.Fragment key={`${textHighlight.id}_rect_${index}`}>
                    <rect
                      x={rect.x * pageWidth}
                      y={rect.y * pageHeight}
                      width={rect.width * pageWidth}
                      height={rect.height * pageHeight}
                      fill="transparent"
                    />
                    {isSelected && (
                      <rect
                        x={rect.x * pageWidth - 1.5}
                        y={rect.y * pageHeight - 1.5}
                        width={rect.width * pageWidth + 3}
                        height={rect.height * pageHeight + 3}
                        fill="none"
                        stroke="#0080f0"
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        className="pointer-events-none"
                      />
                    )}
                  </React.Fragment>
                ))}
              </g>
            );
          })}

        {/* 2. Hit targets and selection for Rect Highlights */}
        {pageAnnotations
          .filter((a) => a.type === 'highlight-rect')
          .map((a) => {
            const rect = a as RectHighlightAnnotation;
            const isSelected = selectedAnnotationId === rect.id;
            return (
              <g
                key={`hit_rect_${rect.id}`}
                className={activeTool === 'select' ? 'pointer-events-auto cursor-pointer' : undefined}
                onClick={(e) => {
                  if (activeTool === 'select') {
                    e.stopPropagation();
                    onSelectAnnotation?.(rect.id);
                  }
                }}
              >
                <rect
                  x={rect.x * pageWidth}
                  y={rect.y * pageHeight}
                  width={rect.width * pageWidth}
                  height={rect.height * pageHeight}
                  fill="transparent"
                />
                {isSelected && (
                  <rect
                    x={rect.x * pageWidth - 1.5}
                    y={rect.y * pageHeight - 1.5}
                    width={rect.width * pageWidth + 3}
                    height={rect.height * pageHeight + 3}
                    fill="none"
                    stroke="#0080f0"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    className="pointer-events-none"
                  />
                )}
              </g>
            );
          })}

        {/* 3. Hit targets and selection for Line Highlights */}
        {pageAnnotations
          .filter((a) => a.type === 'highlight-line')
          .map((a) => {
            const line = a as LineHighlightAnnotation;
            const isSelected = selectedAnnotationId === line.id;
            return (
              <g
                key={`hit_line_${line.id}`}
                className={activeTool === 'select' ? 'pointer-events-auto cursor-pointer' : undefined}
                onClick={(e) => {
                  if (activeTool === 'select') {
                    e.stopPropagation();
                    onSelectAnnotation?.(line.id);
                  }
                }}
                onPointerDown={(e) => {
                  if (activeTool === 'select') {
                    handleLineDragStart(e, line);
                  }
                }}
              >
                {/* Transparent wider line stroke for effortless clicking & dragging */}
                <line
                  x1={line.startX * pageWidth}
                  y1={line.startY * pageHeight}
                  x2={line.endX * pageWidth}
                  y2={line.endY * pageHeight}
                  stroke="transparent"
                  strokeWidth={Math.max(line.strokeWidth, 24)}
                  strokeLinecap="round"
                />
              </g>
            );
          })}
      </svg>

      {/* Floating Snip Dimensions Badge while dragging */}
      {activeTool === 'snip' && snipStart && snipCurrent && (
        <div
          style={{
            left: `${Math.min(snipStart.x, snipCurrent.x) * pageWidth + 6}px`,
            top: `${Math.max(4, Math.min(snipStart.y, snipCurrent.y) * pageHeight - 24)}px`,
          }}
          className="absolute z-50 px-2 py-0.5 rounded-md bg-blue-600/95 text-white font-mono text-[10px] shadow-lg pointer-events-none flex items-center gap-1.5 backdrop-blur-xs animate-fade-in whitespace-nowrap"
        >
          <span className="font-semibold text-blue-100">Snip P.{pageNumber}</span>
          <span className="text-white/80">
            {Math.round(Math.abs(snipCurrent.x - snipStart.x) * pageWidth)} × {Math.round(Math.abs(snipCurrent.y - snipStart.y) * pageHeight)}px
          </span>
        </div>
      )}

      {/* Momentary Captured Confirmation Pill */}
      {capturedFlashRect && (
        <div
          style={{
            left: `${capturedFlashRect.x * pageWidth + 6}px`,
            top: `${Math.max(4, capturedFlashRect.y * pageHeight - 24)}px`,
          }}
          className="absolute z-50 px-2.5 py-1 rounded-md bg-emerald-600 text-white font-medium text-[11px] shadow-xl pointer-events-none flex items-center gap-1.5 backdrop-blur-xs animate-fade-in whitespace-nowrap ring-1 ring-emerald-400"
        >
          <span>✓ Added to Snippets</span>
        </div>
      )}

      {/* Active Text Note Creation Popup */}
      {textInputPos && (
        <div
          style={{
            left: `${Math.min(textInputPos.x * pageWidth, pageWidth - 240)}px`,
            top: `${Math.min(textInputPos.y * pageHeight, pageHeight - 140)}px`,
          }}
          className="absolute z-50 p-2.5 rounded-xl bg-[#24242b] border border-[#383846] shadow-2xl flex flex-col gap-2 min-w-[220px] pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-zinc-400 text-[10.5px] font-medium">
            <span>New Sticky Note</span>
            <span className="text-[9px] text-zinc-500">Enter to save</span>
          </div>

          <textarea
            ref={textNoteTextareaRef}
            autoFocus
            rows={3}
            value={textInputValue}
            onChange={(e) => setTextInputValue(e.target.value)}
            placeholder="Type your note..."
            className="w-full bg-[#1c1c22] border border-[#343440] rounded-md p-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-sans resize-none leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                e.preventDefault();
                handleSaveTextNote();
              } else if (e.key === 'Escape') {
                setTextInputPos(null);
                setTextInputValue('');
              }
            }}
          />

          <div className="flex items-center justify-end gap-1.5 pt-0.5">
            <button
              onClick={() => {
                setTextInputPos(null);
                setTextInputValue('');
              }}
              className="px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#2c2c34]"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveTextNote}
              className="btn-primary px-3 py-1"
            >
              Add Note
            </button>
          </div>
        </div>
      )}

      {/* Bottom-Right Corner Resize Handle for Selected Rect Highlight */}
      {selectedHighlight && selectedHighlight.type === 'highlight-rect' && (
        <div
          style={{
            left: `${(selectedHighlight.x + selectedHighlight.width) * pageWidth}px`,
            top: `${(selectedHighlight.y + selectedHighlight.height) * pageHeight}px`,
            transform: 'translate(-50%, -50%)',
          }}
          onPointerDown={(e) => handleHighlightResizeStart(e, selectedHighlight as RectHighlightAnnotation)}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute z-40 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform pointer-events-auto select-none touch-none"
          title="Drag to resize highlight"
          aria-label="Drag to resize highlight"
        />
      )}

      {/* Endpoint Adjustment Handles for Selected Line Highlight */}
      {selectedHighlight && selectedHighlight.type === 'highlight-line' && (
        <>
          <div
            style={{
              left: `${selectedHighlight.startX * pageWidth}px`,
              top: `${selectedHighlight.startY * pageHeight}px`,
              transform: 'translate(-50%, -50%)',
            }}
            onPointerDown={(e) => handleLineEndpointDragStart(e, selectedHighlight as LineHighlightAnnotation, 'start')}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute z-40 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full cursor-move shadow-md hover:scale-125 transition-transform pointer-events-auto select-none touch-none"
            title="Drag to adjust start point"
            aria-label="Drag to adjust start point"
          />
          <div
            style={{
              left: `${selectedHighlight.endX * pageWidth}px`,
              top: `${selectedHighlight.endY * pageHeight}px`,
              transform: 'translate(-50%, -50%)',
            }}
            onPointerDown={(e) => handleLineEndpointDragStart(e, selectedHighlight as LineHighlightAnnotation, 'end')}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute z-40 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full cursor-move shadow-md hover:scale-125 transition-transform pointer-events-auto select-none touch-none"
            title="Drag to adjust end point"
            aria-label="Drag to adjust end point"
          />
        </>
      )}

      {/* Floating Quick Action Menu for Selected Highlight */}
      {selectedHighlight && (
        <div
          style={{
            left: `${Math.max(8, Math.min(selectedHighlightPos.x, pageWidth - 240))}px`,
            top: `${Math.max(8, selectedHighlightPos.y - 38)}px`,
          }}
          className="absolute z-50 flex items-center gap-1.5 p-1 px-1.5 rounded-lg bg-[var(--popover)]/95 border border-[var(--border)] shadow-xl backdrop-blur-md pointer-events-auto select-none"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Drag Grip Handle for Rect or Line Highlight */}
          {(selectedHighlight.type === 'highlight-rect' || selectedHighlight.type === 'highlight-line') && (
            <div
              onPointerDown={(e) => {
                if (selectedHighlight.type === 'highlight-rect') {
                  handleHighlightDragStart(e, selectedHighlight as RectHighlightAnnotation);
                } else if (selectedHighlight.type === 'highlight-line') {
                  handleLineDragStart(e, selectedHighlight as LineHighlightAnnotation);
                }
              }}
              className="flex items-center justify-center px-1.5 py-1 rounded-md bg-black/8 hover:bg-black/15 dark:bg-white/5 dark:hover:bg-white/10 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-grab active:cursor-grabbing transition-colors touch-none"
              title="Drag to move highlight"
              aria-label="Drag to move highlight"
            >
              <GripHorizontal className="w-3.5 h-3.5" />
            </div>
          )}

          {/* Color Swatches */}
          <div className="flex items-center gap-1 pr-1.5 border-r border-[var(--border)]">
            {QUICK_HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onUpdateAnnotation?.(selectedHighlight.id, { color: c })}
                className={`w-4 h-4 rounded-full border transition-transform hover:scale-115 ${
                  selectedHighlight.color.toLowerCase() === c.toLowerCase()
                    ? 'ring-2 ring-blue-500 scale-110 border-white/60'
                    : 'border-black/20 hover:border-white/40'
                }`}
                style={{ backgroundColor: c }}
                title="Change color"
              />
            ))}
          </div>

          {/* Persistent style toggles: changing one annotation also sets the next-draw mode. */}
          {selectedHighlight.type === 'highlight-rect' && (
            <button
              type="button"
              onClick={() => {
                const nextStyle = toggleHighlightStyle(selectedHighlight.style ?? 'box', 'stroke');
                onUpdateAnnotation?.(selectedHighlight.id, {
                  style: nextStyle,
                  opacity: resolveHighlightOpacity(nextStyle, opacity),
                });
                onChangeHighlightStyle?.(nextStyle);
              }}
              className={`w-5 h-5 rounded flex items-center justify-center transition-colors border ${
                selectedHighlight.style === 'stroke'
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/35'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-[var(--secondary)]'
              }`}
              title={selectedHighlight.style === 'stroke' ? 'Switch to Filled Box Highlight' : 'Switch to Outline / Stroke'}
              aria-label={selectedHighlight.style === 'stroke' ? 'Switch to Filled Box Highlight' : 'Switch to Outline / Stroke'}
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          )}

          {(selectedHighlight.type === 'highlight-text' ||
            selectedHighlight.type === 'highlight-line') && (
            <button
              type="button"
              onClick={() => {
                const currentStyle = selectedHighlight.style === 'underline' ? 'underline' : 'box';
                const nextStyle = toggleHighlightStyle(currentStyle, 'underline');
                onUpdateAnnotation?.(selectedHighlight.id, {
                  style:
                    selectedHighlight.type === 'highlight-line' && nextStyle === 'box'
                      ? 'highlight'
                      : nextStyle,
                  opacity: resolveHighlightOpacity(nextStyle, opacity),
                });
                onChangeHighlightStyle?.(nextStyle);
              }}
              className={`w-5 h-5 rounded flex items-center justify-center transition-colors border ${
                selectedHighlight.style === 'underline'
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/35'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-[var(--secondary)]'
              }`}
              title={
                selectedHighlight.style === 'underline'
                  ? selectedHighlight.type === 'highlight-line'
                    ? 'Switch to Line Highlight'
                    : 'Switch to Box Highlight'
                  : 'Switch to Underline'
              }
              aria-label={
                selectedHighlight.style === 'underline'
                  ? selectedHighlight.type === 'highlight-line'
                    ? 'Switch to Line Highlight'
                    : 'Switch to Box Highlight'
                  : 'Switch to Underline'
              }
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete Button */}
          <button
            type="button"
            onClick={() => {
              onDeleteAnnotation(selectedHighlight.id);
              onSelectAnnotation?.(null);
            }}
            className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete highlight"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={() => onSelectAnnotation?.(null)}
            className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-[var(--secondary)] transition-colors"
            title="Deselect"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
