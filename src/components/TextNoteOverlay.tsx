import React, { useState, useRef, useEffect } from 'react';
import { Trash2, GripHorizontal, Edit3, Check, Palette } from 'lucide-react';
import type { TextNoteAnnotation, ReadingTheme, ToolType } from '../utils/types';

interface TextNoteOverlayProps {
  annotation: TextNoteAnnotation;
  isSelected: boolean;
  pageWidth: number;
  pageHeight: number;
  currentTheme: ReadingTheme;
  activeTool: ToolType;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<TextNoteAnnotation>) => void;
  onDelete: (id: string) => void;
}

const NOTE_COLORS = [
  { name: 'Yellow', bg: '#fef08a', text: '#713f12', border: '#fde047' },
  { name: 'Amber', bg: '#fde68a', text: '#78350f', border: '#fcd34d' },
  { name: 'Green', bg: '#bbf7d0', text: '#14532d', border: '#86efac' },
  { name: 'Blue', bg: '#bae6fd', text: '#0c4a6e', border: '#7dd3fc' },
  { name: 'Coral', bg: '#fecdd3', text: '#881337', border: '#fda4af' },
  { name: 'Purple', bg: '#e9d5ff', text: '#581c87', border: '#d8b4fe' },
  { name: 'Dark Slate', bg: '#272730', text: '#f4f4f5', border: '#444452' },
];

export const TextNoteOverlay: React.FC<TextNoteOverlayProps> = ({
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
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(annotation.text);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const initialAnnPosRef = useRef({ x: 0, y: 0 });

  const leftPx = annotation.x * pageWidth;
  const topPx = annotation.y * pageHeight;

  // Auto focus textarea when editing starts
  useEffect(() => {
    if (isEditing) {
      setEditText(annotation.text);
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      }, 50);
    }
  }, [isEditing, annotation.text]);

  // Find color config or match preset
  const currentColor = NOTE_COLORS.find(
    (c) => c.bg.toLowerCase() === (annotation.color || '').toLowerCase()
  ) || {
    name: 'Custom',
    bg: annotation.color || '#fef08a',
    text: '#18181b',
    border: '#fde047',
  };

  // Dragging logic
  const handleMouseDownDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTool === 'eraser') {
      onDelete(annotation.id);
      return;
    }
    onSelect(annotation.id);
    isDraggingRef.current = true;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    initialAnnPosRef.current = { x: annotation.x, y: annotation.y };

    const handleMouseMove = (moveEvt: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = (moveEvt.clientX - dragStartPosRef.current.x) / pageWidth;
      const dy = (moveEvt.clientY - dragStartPosRef.current.y) / pageHeight;

      const newX = Math.max(0, Math.min(initialAnnPosRef.current.x + dx, 0.92));
      const newY = Math.max(0, Math.min(initialAnnPosRef.current.y + dy, 0.95));

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

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onUpdate(annotation.id, { text: editText.trim() });
    } else {
      onDelete(annotation.id);
    }
    setIsEditing(false);
    setShowColorPicker(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTool === 'eraser') {
      onDelete(annotation.id);
      return;
    }
    onSelect(annotation.id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTool !== 'eraser') {
      setIsEditing(true);
    }
  };

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        left: `${leftPx}px`,
        top: `${topPx}px`,
        maxWidth: '260px',
        minWidth: '140px',
      }}
      className={`absolute z-30 select-none group transition-shadow rounded-lg shadow-lg ${
        isSelected
          ? 'ring-2 ring-blue-500 shadow-2xl'
          : 'hover:ring-1 hover:ring-zinc-400/60'
      }`}
    >
      {/* Sticky Note Container */}
      <div
        style={{
          backgroundColor: currentColor.bg,
          color: currentColor.text,
          borderColor: currentColor.border,
        }}
        className="rounded-lg border p-2.5 flex flex-col gap-1.5 shadow-xs font-sans text-xs"
      >
        {/* Header Drag Handle & Controls (Visible on hover or when selected) */}
        <div
          onMouseDown={handleMouseDownDrag}
          className="flex items-center justify-between cursor-grab active:cursor-grabbing pb-1 border-b border-black/10 text-black/60 hover:text-black"
        >
          <div className="flex items-center gap-1">
            <GripHorizontal className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wider opacity-75">
              Note
            </span>
          </div>

          <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
            {/* Palette Color Picker */}
            <button
              onClick={() => setShowColorPicker((prev) => !prev)}
              className="p-0.5 rounded hover:bg-black/10 text-black/70 hover:text-black transition-colors"
              title="Change note color"
            >
              <Palette className="w-3 h-3" />
            </button>

            {/* Edit Button */}
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-0.5 rounded hover:bg-black/10 text-black/70 hover:text-black transition-colors"
                title="Edit note text"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            )}

            {/* Delete Button */}
            <button
              onClick={() => onDelete(annotation.id)}
              className="p-0.5 rounded hover:bg-red-500/20 text-red-700 hover:text-red-900 transition-colors"
              title="Delete note (Delete key)"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Color Picker Swatches Dropdown */}
        {showColorPicker && (
          <div
            className="flex items-center gap-1 py-1 px-1 bg-black/15 rounded-md justify-between"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {NOTE_COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => {
                  onUpdate(annotation.id, { color: c.bg });
                  setShowColorPicker(false);
                }}
                style={{ backgroundColor: c.bg, borderColor: c.border }}
                className="w-4 h-4 rounded-full border shadow-xs hover:scale-115 transition-transform"
                title={c.name}
              />
            ))}
          </div>
        )}

        {/* Note Content (Editing vs Viewing) */}
        {isEditing ? (
          <div className="flex flex-col gap-1.5 pt-0.5" onMouseDown={(e) => e.stopPropagation()}>
            <textarea
              ref={textareaRef}
              rows={3}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Write your note..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSaveEdit();
                } else if (e.key === 'Escape') {
                  setIsEditing(false);
                }
              }}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.4)',
                color: currentColor.text,
              }}
              className="w-full rounded p-1.5 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-black/30 resize-none leading-relaxed"
            />
            <div className="flex justify-end gap-1">
              <button
                onClick={() => setIsEditing(false)}
                className="px-2 py-0.5 rounded text-[10.5px] opacity-75 hover:opacity-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-black/80 hover:bg-black text-white text-[10.5px] font-medium shadow-xs"
              >
                <Check className="w-3 h-3" />
                <span>Save</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            className="whitespace-pre-wrap break-words leading-relaxed py-0.5 font-normal"
            style={{ fontSize: `${annotation.fontSize || 12}px` }}
          >
            {annotation.text}
          </div>
        )}
      </div>
    </div>
  );
};
