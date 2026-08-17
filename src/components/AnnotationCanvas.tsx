import React, { useState, useRef } from 'react';
import type {
  Annotation,
  DrawingAnnotation,
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
  strokeWidth: number;
  opacity: number;
  annotations: Annotation[];
  onAddAnnotation: (ann: Annotation) => void;
  onDeleteAnnotation: (id: string) => void;
}

// Distance from point to line segment in pixels
function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  pageNumber,
  pageWidth,
  pageHeight,
  activeTool,
  selectedColor,
  strokeWidth,
  opacity,
  annotations,
  onAddAnnotation,
  onDeleteAnnotation,
}) => {
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[] | null>(null);
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);
  const [rectCurrent, setRectCurrent] = useState<{ x: number; y: number } | null>(null);
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');
  const [eraserCursorPos, setEraserCursorPos] = useState<{ x: number; y: number } | null>(null);

  const isInteractingRef = useRef(false);
  const isMouseDownRef = useRef(false);

  // Helper to convert mouse event to normalized coordinates (0..1)
  const getNormalizedCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y, px: e.clientX - rect.left, py: e.clientY - rect.top };
  };

  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);

  // Hit-test and erase annotations near (px, py)
  const performEraseAt = (px: number, py: number) => {
    const ERASE_RADIUS = 20; // 20px hit-test radius for effortless erasing

    for (const ann of pageAnnotations) {
      if (ann.type === 'pen' || ann.type === 'highlight-pen') {
        const drawAnn = ann as DrawingAnnotation;
        const pts = drawAnn.points;
        for (let i = 0; i < pts.length - 1; i++) {
          const x1 = pts[i].x * pageWidth;
          const y1 = pts[i].y * pageHeight;
          const x2 = pts[i + 1].x * pageWidth;
          const y2 = pts[i + 1].y * pageHeight;
          const d = distToSegment(px, py, x1, y1, x2, y2);
          if (d <= ERASE_RADIUS + (drawAnn.strokeWidth || 3)) {
            onDeleteAnnotation(ann.id);
            break;
          }
        }
      } else if (ann.type === 'highlight-rect') {
        const hRect = ann as RectHighlightAnnotation;
        const rx = hRect.x * pageWidth;
        const ry = hRect.y * pageHeight;
        const rw = hRect.width * pageWidth;
        const rh = hRect.height * pageHeight;

        // Check if inside rect or near borders
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
        if (Math.hypot(px - nx, py - ny) <= ERASE_RADIUS + 30) {
          onDeleteAnnotation(ann.id);
        }
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'select' || activeTool === 'image') return;
    isMouseDownRef.current = true;

    const { x, y, px, py } = getNormalizedCoords(e);

    if (activeTool === 'eraser') {
      performEraseAt(px, py);
    } else if (activeTool === 'pen' || activeTool === 'highlight-pen') {
      isInteractingRef.current = true;
      setCurrentStroke([{ x, y }]);
    } else if (activeTool === 'highlight-rect') {
      isInteractingRef.current = true;
      setRectStart({ x, y });
      setRectCurrent({ x, y });
    } else if (activeTool === 'text') {
      setTextInputPos({ x, y });
      setTextInputValue('');
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { x, y, px, py } = getNormalizedCoords(e);

    if (activeTool === 'eraser') {
      setEraserCursorPos({ x: px, y: py });
      if (isMouseDownRef.current) {
        performEraseAt(px, py);
      }
      return;
    }

    if (!isInteractingRef.current) return;

    if (activeTool === 'pen' || activeTool === 'highlight-pen') {
      setCurrentStroke((prev) => (prev ? [...prev, { x, y }] : [{ x, y }]));
    } else if (activeTool === 'highlight-rect') {
      setRectCurrent({ x, y });
    }
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
    if (activeTool === 'eraser') return;

    if (!isInteractingRef.current) return;
    isInteractingRef.current = false;

    if (
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
    }
  };

  const handleMouseLeave = () => {
    isMouseDownRef.current = false;
    setEraserCursorPos(null);
    if (isInteractingRef.current) {
      handleMouseUp();
    }
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
        color: selectedColor,
        fontSize: 13,
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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      className={`absolute inset-0 z-20 select-none ${
        activeTool === 'select'
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
                x={rect.x * pageWidth}
                y={rect.y * pageHeight}
                width={rect.width * pageWidth}
                height={rect.height * pageHeight}
                fill={rect.color}
                fillOpacity={rect.opacity || 0.4}
                rx={3}
                style={{ mixBlendMode: 'multiply' }}
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
                d={pointsToSvgPath(draw.points)}
                stroke={draw.color}
                strokeWidth={draw.strokeWidth}
                strokeOpacity={draw.opacity}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                style={draw.type === 'highlight-pen' ? { mixBlendMode: 'multiply' } : undefined}
              />
            );
          })}

        {/* Active Freehand Drawing in progress */}
        {currentStroke && (
          <path
            d={pointsToSvgPath(currentStroke)}
            stroke={selectedColor}
            strokeWidth={activeTool === 'highlight-pen' ? strokeWidth * 2.5 : strokeWidth}
            strokeOpacity={activeTool === 'highlight-pen' ? opacity : 1}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            style={activeTool === 'highlight-pen' ? { mixBlendMode: 'multiply' } : undefined}
          />
        )}

        {/* Active Rectangle Highlight in progress */}
        {rectStart && rectCurrent && (
          <rect
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
            style={{ mixBlendMode: 'multiply' }}
          />
        )}
      </svg>

      {/* Render Text Notes */}
      {pageAnnotations
        .filter((a) => a.type === 'text-note')
        .map((a) => {
          const note = a as TextNoteAnnotation;
          return (
            <div
              key={note.id}
              style={{
                left: `${note.x * pageWidth}px`,
                top: `${note.y * pageHeight}px`,
                color: note.color,
                fontSize: `${note.fontSize}px`,
              }}
              className="absolute p-1.5 rounded bg-yellow-100/90 text-zinc-900 border border-yellow-300 shadow-md font-sans text-xs max-w-xs pointer-events-auto"
            >
              {note.text}
            </div>
          );
        })}

      {/* Active Text Note Input */}
      {textInputPos && (
        <div
          style={{
            left: `${textInputPos.x * pageWidth}px`,
            top: `${textInputPos.y * pageHeight}px`,
          }}
          className="absolute z-50 p-2 rounded-xl bg-[#1a1a22] border border-white/20 shadow-2xl flex flex-col gap-2 min-w-[200px]"
          onClick={(e) => e.stopPropagation()}
        >
          <textarea
            autoFocus
            rows={2}
            value={textInputValue}
            onChange={(e) => setTextInputValue(e.target.value)}
            placeholder="Type your note..."
            className="w-full bg-black/40 border border-white/10 rounded-lg p-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSaveTextNote();
              }
            }}
          />
          <div className="flex justify-end gap-1">
            <button
              onClick={() => setTextInputPos(null)}
              className="px-2 py-1 rounded text-[11px] text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveTextNote}
              className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium"
            >
              Add Note
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
