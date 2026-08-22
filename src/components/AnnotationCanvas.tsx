import React, { useRef, useState } from 'react';
import type {
  Annotation,
  DrawingAnnotation,
  LineHighlightAnnotation,
  RectHighlightAnnotation,
  StrokePoint,
  TextNoteAnnotation,
  ToolType,
} from '../utils/types';

interface AnnotationCanvasProps {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  activeTool: ToolType;
  selectedColor: string;
  isInvertedColorMode: boolean;
  strokeWidth: number;
  opacity: number;
  annotations: Annotation[];
  onAddAnnotation: (ann: Annotation) => void;
  onDeleteAnnotation: (id: string) => void;
  onCaptureSnippet?: (pageNumber: number, rect: { x: number; y: number; width: number; height: number }) => void;
}

// Distance from point to line segment helper
function distToSegment(
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
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
  annotations,
  onAddAnnotation,
  onDeleteAnnotation,
  onCaptureSnippet,
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

  // Text Note Input Popup State
  const [textInputPos, setTextInputPos] = useState<StrokePoint | null>(null);
  const [textInputValue, setTextInputValue] = useState<string>('');

  // Eraser Brush Indicator Position
  const [eraserCursorPos, setEraserCursorPos] = useState<{ x: number; y: number } | null>(null);

  const isMouseDownRef = useRef(false);
  const isInteractingRef = useRef(false);
  const highlightBlendMode = 'multiply';
  const colorFilterClass = isInvertedColorMode ? 'annotation-color-preview-invert' : undefined;

  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);

  // Flash feedback state after capturing a snippet
  const [capturedFlashRect, setCapturedFlashRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

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

  // Helper for eraser tool: finds any annotation near point (px, py) and deletes it
  const performEraseAt = (px: number, py: number) => {
    const ERASE_RADIUS = 22;

    for (const ann of pageAnnotations) {
      if (ann.type === 'pen' || ann.type === 'highlight-pen') {
        const drawAnn = ann as DrawingAnnotation;
        for (const pt of drawAnn.points) {
          const ptX = pt.x * pageWidth;
          const ptY = pt.y * pageHeight;
          if (Math.hypot(px - ptX, py - ptY) <= ERASE_RADIUS + drawAnn.strokeWidth) {
            onDeleteAnnotation(ann.id);
            break;
          }
        }
      } else if (ann.type === 'highlight-line') {
        const lineAnn = ann as LineHighlightAnnotation;
        const x1 = lineAnn.startX * pageWidth;
        const y1 = lineAnn.startY * pageHeight;
        const x2 = lineAnn.endX * pageWidth;
        const y2 = lineAnn.endY * pageHeight;
        const dist = distToSegment({ x: px, y: py }, { x: x1, y: y1 }, { x: x2, y: y2 });
        if (dist <= ERASE_RADIUS + (lineAnn.strokeWidth || 10) / 2) {
          onDeleteAnnotation(ann.id);
        }
      } else if (ann.type === 'highlight-rect') {
        const hRect = ann as RectHighlightAnnotation;
        const rx = hRect.x * pageWidth;
        const ry = hRect.y * pageHeight;
        const rw = hRect.width * pageWidth;
        const rh = hRect.height * pageHeight;

        if (
          px >= rx - ERASE_RADIUS &&
          px <= rx + rw + ERASE_RADIUS &&
          py >= ry - ERASE_RADIUS &&
          py <= ry + rh + ERASE_RADIUS
        ) {
          onDeleteAnnotation(ann.id);
        }
      } else if (ann.type === 'text-note') {
        const note = ann as TextNoteAnnotation;
        const nx = note.x * pageWidth;
        const ny = note.y * pageHeight;
        if (Math.hypot(px - nx, py - ny) <= ERASE_RADIUS + 40) {
          onDeleteAnnotation(ann.id);
        }
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (activeTool === 'select' || activeTool === 'image') return;
    isMouseDownRef.current = true;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const { x, y, px, py } = getNormalizedCoords(e);

    if (activeTool === 'eraser') {
      performEraseAt(px, py);
    } else if (activeTool === 'highlight-line') {
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
    } else if (activeTool === 'text') {
      setTextInputPos({ x, y });
      setTextInputValue('');
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const { x, y, px, py } = getNormalizedCoords(e);

    if (activeTool === 'eraser') {
      setEraserCursorPos({ x: px, y: py });
      if (isMouseDownRef.current) {
        performEraseAt(px, py);
      }
      return;
    }

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
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    isMouseDownRef.current = false;
    if (activeTool === 'eraser') return;

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
          opacity,
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
          opacity: opacity,
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
      className={`absolute inset-0 z-20 select-none touch-none ${
        activeTool === 'select' || activeTool === 'image'
          ? 'pointer-events-none'
          : activeTool === 'eraser'
          ? 'cursor-none pointer-events-auto'
          : 'cursor-crosshair pointer-events-auto'
      }`}
    >
      {/* Visual Eraser Brush Circle Indicator */}
      {activeTool === 'eraser' && eraserCursorPos && (
        <div
          style={{
            left: `${eraserCursorPos.x}px`,
            top: `${eraserCursorPos.y}px`,
            width: '36px',
            height: '36px',
            transform: 'translate(-50%, -50%)',
          }}
          className="absolute rounded-full border-2 border-red-400/80 bg-red-500/20 pointer-events-none shadow-md backdrop-blur-2xs animate-pulse-glow z-50"
        />
      )}

      <svg
        className="w-full h-full absolute inset-0 pointer-events-none"
        style={{ width: `${pageWidth}px`, height: `${pageHeight}px` }}
      >
        {/* Render Existing Rect Highlights */}
        {pageAnnotations
          .filter((a) => a.type === 'highlight-rect')
          .map((a) => {
            const rect = a as RectHighlightAnnotation;
            return (
              <rect
                key={rect.id}
                className={colorFilterClass}
                x={rect.x * pageWidth}
                y={rect.y * pageHeight}
                width={rect.width * pageWidth}
                height={rect.height * pageHeight}
                fill={rect.color}
                fillOpacity={rect.opacity || 0.4}
                rx={3}
                style={{ mixBlendMode: highlightBlendMode }}
              />
            );
          })}

        {/* Render Existing Straight Line Highlights */}
        {pageAnnotations
          .filter((a) => a.type === 'highlight-line')
          .map((a) => {
            const line = a as LineHighlightAnnotation;
            return (
              <line
                key={line.id}
                className={colorFilterClass}
                x1={line.startX * pageWidth}
                y1={line.startY * pageHeight}
                x2={line.endX * pageWidth}
                y2={line.endY * pageHeight}
                stroke={line.color}
                strokeWidth={line.strokeWidth}
                strokeOpacity={line.opacity}
                strokeLinecap="square"
                style={{ mixBlendMode: highlightBlendMode }}
              />
            );
          })}

        {/* Render Existing Freehand Drawings & Highlights */}
        {pageAnnotations
          .filter((a) => a.type === 'pen' || a.type === 'highlight-pen')
          .map((a) => {
            const draw = a as DrawingAnnotation;
            return (
              <path
                key={draw.id}
                className={colorFilterClass}
                d={pointsToSvgPath(draw.points)}
                stroke={draw.color}
                strokeWidth={draw.strokeWidth}
                strokeOpacity={draw.opacity}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                style={draw.type === 'highlight-pen' ? { mixBlendMode: highlightBlendMode } : undefined}
              />
            );
          })}

        {/* Active Straight Line Highlight in progress */}
        {lineStart && lineCurrent && (
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
            strokeWidth={strokeWidth * 2.8}
            strokeOpacity={opacity}
            strokeLinecap="square"
            style={{ mixBlendMode: highlightBlendMode }}
          />
        )}

        {/* Active Freehand Drawing in progress */}
        {currentStroke && (
          <path
            className={colorFilterClass}
            d={pointsToSvgPath(currentStroke)}
            stroke={selectedColor}
            strokeWidth={activeTool === 'highlight-pen' ? strokeWidth * 2.5 : strokeWidth}
            strokeOpacity={activeTool === 'highlight-pen' ? opacity : 1}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            style={activeTool === 'highlight-pen' ? { mixBlendMode: highlightBlendMode } : undefined}
          />
        )}

        {/* Active Rectangle Highlight in progress */}
        {rectStart && rectCurrent && (
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
            strokeDasharray="4 2"
            rx={3}
            style={{ mixBlendMode: highlightBlendMode }}
          />
        )}

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
              strokeWidth={2}
              strokeDasharray="6 3"
              rx={3}
            />
          </g>
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
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-zinc-400 text-[10.5px] font-medium">
            <span>New Sticky Note</span>
            <span className="text-[9px] text-zinc-500">Enter to save</span>
          </div>

          <textarea
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
    </div>
  );
};
