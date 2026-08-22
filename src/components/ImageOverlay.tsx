import React, { useRef } from 'react';
import { Trash2, RotateCw, Sun, Moon } from 'lucide-react';
import type { AttachedImageAnnotation, ReadingTheme, ToolType } from '../utils/types';

interface ImageOverlayProps {
  annotation: AttachedImageAnnotation;
  isSelected: boolean;
  pageWidth: number;
  pageHeight: number;
  currentTheme: ReadingTheme;
  activeTool?: ToolType;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<AttachedImageAnnotation>) => void;
  onDelete: (id: string) => void;
}

export const ImageOverlay: React.FC<ImageOverlayProps> = ({
  annotation,
  isSelected,
  pageWidth,
  pageHeight,
  currentTheme,
  activeTool,
  onSelect,
  onUpdate,
  onDelete,
}) => {
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const initialAnnPosRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Pixel coordinates on current page canvas
  const leftPx = annotation.x * pageWidth;
  const topPx = annotation.y * pageHeight;
  const widthPx = annotation.width * pageWidth;
  const heightPx = annotation.height * pageHeight;

  const isDarkTheme = currentTheme !== 'default' && currentTheme !== 'sepia';
  const shouldInvertForLight = Boolean(
    annotation.invertInLightMode ?? annotation.attachedInInvertedMode
  );

  // Compute CSS filter for the image
  let imageFilterStyle: React.CSSProperties = {};
  let imageClassName = 'w-full h-full object-contain pointer-events-none rounded transition-all duration-300';

  if (shouldInvertForLight) {
    if (!isDarkTheme) {
      // In Light/Normal mode: Invert image colors so dark-mode image fits white paper
      imageFilterStyle = { filter: 'invert(1) hue-rotate(180deg)' };
    } else {
      // In Inverted mode: Leave as-is without counter-inversion so it matches dark paper
      imageClassName += ' no-counter-invert';
    }
  } else {
    // Normal image: counter-invert when page is dark so it retains true photo colors
    if (isDarkTheme) {
      imageClassName += ' preserve-image-color';
    }
  }

  // Handle Dragging
  const handleMouseDownDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(annotation.id);
    isDraggingRef.current = true;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    initialAnnPosRef.current = {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height,
    };

    const handleMouseMove = (moveEvt: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = (moveEvt.clientX - dragStartPosRef.current.x) / pageWidth;
      const dy = (moveEvt.clientY - dragStartPosRef.current.y) / pageHeight;

      const newX = Math.max(0, Math.min(initialAnnPosRef.current.x + dx, 1 - annotation.width));
      const newY = Math.max(0, Math.min(initialAnnPosRef.current.y + dy, 1 - annotation.height));

      onUpdate(annotation.id, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Handle Resizing (Bottom-Right handle)
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    isResizingRef.current = true;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    initialAnnPosRef.current = {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height,
    };

    const handleMouseMove = (moveEvt: MouseEvent) => {
      if (!isResizingRef.current) return;
      const dx = (moveEvt.clientX - dragStartPosRef.current.x) / pageWidth;
      const newWidth = Math.max(0.05, Math.min(initialAnnPosRef.current.width + dx, 1 - annotation.x));
      const aspectRatio = annotation.aspectRatio || 1.33;
      const pixelWidth = newWidth * pageWidth;
      const pixelHeight = pixelWidth / aspectRatio;
      const newHeight = pixelHeight / pageHeight;

      if (annotation.y + newHeight <= 1) {
        onUpdate(annotation.id, { width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftPx}px`,
        top: `${topPx}px`,
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        transform: annotation.rotation ? `rotate(${annotation.rotation}deg)` : undefined,
        opacity: annotation.opacity ?? 1,
        zIndex: isSelected ? 30 : 15,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (activeTool === 'eraser') {
          onDelete(annotation.id);
        } else {
          onSelect(annotation.id);
        }
      }}
      onMouseDown={(e) => {
        if (activeTool === 'eraser') {
          e.stopPropagation();
          onDelete(annotation.id);
        } else {
          handleMouseDownDrag(e);
        }
      }}
      className={`group select-none transition-shadow ${
        activeTool === 'eraser'
          ? 'cursor-pointer hover:opacity-40 ring-2 ring-red-400'
          : isSelected
          ? 'cursor-grab active:cursor-grabbing ring-2 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)] rounded-lg'
          : 'cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-white/40'
      }`}
    >
      {/* The Attached Image */}
      <img
        src={annotation.dataUrl}
        alt={annotation.name || 'Attached'}
        className={imageClassName}
        style={imageFilterStyle}
        draggable={false}
        onLoad={(e) => {
          const img = e.currentTarget;
          const naturalW = img.naturalWidth;
          const naturalH = img.naturalHeight;
          if (naturalW > 0 && naturalH > 0 && pageWidth > 0 && pageHeight > 0) {
            const actualRatio = naturalW / naturalH;
            if (
              !annotation.aspectRatio ||
              Math.abs(annotation.aspectRatio - actualRatio) > 0.05
            ) {
              const currentPixelW = annotation.width * pageWidth;
              const correctedPixelH = currentPixelW / actualRatio;
              const correctedHeight = correctedPixelH / pageHeight;
              if (annotation.y + correctedHeight <= 1.05) {
                onUpdate(annotation.id, {
                  aspectRatio: actualRatio,
                  height: Math.min(correctedHeight, 0.95),
                });
              }
            }
          }
        }}
      />

      {/* Selection Handles and Quick Controls */}
      {isSelected && (
        <>
          {/* Quick Floating Action Bar on top */}
          <div
            className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 rounded-lg bg-[#141418]/95 border border-white/20 backdrop-blur-xl shadow-2xl z-50 animate-slide-up whitespace-nowrap"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Opacity slider */}
            <input
              type="range"
              min="20"
              max="100"
              value={Math.round((annotation.opacity ?? 1) * 100)}
              onChange={(e) =>
                onUpdate(annotation.id, { opacity: parseInt(e.target.value, 10) / 100 })
              }
              className="w-12 h-1.5 accent-blue-500 cursor-pointer ml-1"
              title="Image Opacity"
            />

            {/* Smart Invert in Light Mode Toggle */}
            <button
              onClick={() =>
                onUpdate(annotation.id, { invertInLightMode: !shouldInvertForLight })
              }
              className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-medium border transition-all ${
                shouldInvertForLight
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-xs'
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
              }`}
              title={
                shouldInvertForLight
                  ? 'Auto-Invert in Light Mode: ACTIVE (Image will invert for white paper)'
                  : 'Auto-Invert in Light Mode: OFF (Image will stay original)'
              }
            >
              {shouldInvertForLight ? (
                <Moon className="w-3 h-3 text-purple-400" />
              ) : (
                <Sun className="w-3 h-3 text-zinc-400" />
              )}
              <span>{shouldInvertForLight ? 'Auto-Invert ON' : 'Auto-Invert OFF'}</span>
            </button>

            {/* Rotate */}
            <button
              onClick={() =>
                onUpdate(annotation.id, { rotation: ((annotation.rotation || 0) + 90) % 360 })
              }
              className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10"
              title="Rotate 90°"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            {/* Delete */}
            <button
              onClick={() => onDelete(annotation.id)}
              className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/20"
              title="Delete Image"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Corner Resize Handles */}
          <div
            onMouseDown={handleMouseDownResize}
            className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
            title="Drag to resize"
          />
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-blue-500/80 rounded-full pointer-events-none" />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500/80 rounded-full pointer-events-none" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-blue-500/80 rounded-full pointer-events-none" />
        </>
      )}
    </div>
  );
};
