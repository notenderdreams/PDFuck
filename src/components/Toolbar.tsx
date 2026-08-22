import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer,
  Highlighter,
  PenLine,
  Square,
  PenTool,
  Crop,
  Type,
  Eraser,
  ScanSearch,
} from 'lucide-react';
import type { ToolType } from '../utils/types';

interface ToolbarProps {
  activeTool: ToolType;
  selectedColor: string;
  isInvertedColorMode: boolean;
  strokeWidth: number;
  opacity: number;
  canUndo?: boolean;
  canRedo?: boolean;
  onSelectTool: (tool: ToolType) => void;
  onSelectColor: (color: string) => void;
  onChangeStrokeWidth: (width: number) => void;
  onChangeOpacity: (opacity: number) => void;
  onAttachImageClick?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClearPageAnnotations?: () => void;
}

const COLOR_PRESETS = [
  '#facc15', // Classic Yellow
  '#fbbf24', // Amber Sand
  '#4ade80', // Soft Sage Green
  '#38bdf8', // Soft Sky Blue
  '#fb7185', // Warm Coral
  '#c084fc', // Lavender
  '#f87171', // Soft Red
  '#ffffff', // Monochrome White
];

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  selectedColor,
  isInvertedColorMode,
  strokeWidth,
  onSelectTool,
  onSelectColor,
  onChangeStrokeWidth,
}) => {
  const [showPalette, setShowPalette] = useState(false);
  const paletteRef = useRef<HTMLDivElement | null>(null);

  // Click-outside and Escape key dismissal for color palette popover
  useEffect(() => {
    if (!showPalette) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setShowPalette(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPalette(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPalette]);

  const tools: { id: ToolType; icon: React.FC<{ className?: string }>; label: string; shortcut: string }[] = [
    { id: 'select', icon: MousePointer, label: 'Pointer Tool (V)', shortcut: 'V' },
    { id: 'highlight-line', icon: PenLine, label: 'Straight Line Highlighter (L)', shortcut: 'L' },
    { id: 'highlight-pen', icon: Highlighter, label: 'Freehand Highlighter (H)', shortcut: 'H' },
    { id: 'highlight-rect', icon: Square, label: 'Area Box (R)', shortcut: 'R' },
    { id: 'pen', icon: PenTool, label: 'Pen Tool (P)', shortcut: 'P' },
    { id: 'snip', icon: Crop, label: 'Snip & Compact for AI (C)', shortcut: 'C' },
    { id: 'ai-box', icon: ScanSearch, label: 'Explain Region with Codex (A)', shortcut: 'A' },
    { id: 'text', icon: Type, label: 'Text Note (T)', shortcut: 'T' },
    { id: 'eraser', icon: Eraser, label: 'Eraser (E)', shortcut: 'E' },
  ];

  return (
    <nav
      aria-label="Annotation Tools"
      className="macos-annotation-toolbar fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 p-1 rounded-full select-none animate-slide-up"
    >
      {/* Tool Buttons */}
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onSelectTool(tool.id)}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
              isActive
                ? 'bg-blue-500 text-white shadow-xs scale-102'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
            title={tool.label}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}

      {/* Subtle Inset Divider */}
      <div className="w-[1px] h-4 bg-[var(--border)] mx-0.5" />

      {/* Color Swatch & Stroke Well */}
      <div className="relative" ref={paletteRef}>
        <button
          onClick={() => setShowPalette(!showPalette)}
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all p-1"
          title="Color & Stroke"
        >
          <span
            className={`w-4 h-4 rounded-full border border-white/20 shadow-xs ${
              isInvertedColorMode ? 'annotation-color-preview-invert' : ''
            }`}
            style={{ backgroundColor: selectedColor }}
          />
        </button>

        {/* Color & Stroke Popover */}
        {showPalette && (
          <div className="absolute bottom-11 left-1/2 -translate-x-1/2 p-3.5 rounded-2xl bg-[var(--popover)] border border-[var(--border)] shadow-2xl flex flex-col gap-3 min-w-[190px] animate-slide-up z-50">
            <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              <span>Swatches</span>
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => onSelectColor(e.target.value)}
                className={`w-4.5 h-4.5 rounded-full border-0 bg-transparent cursor-pointer ${
                  isInvertedColorMode ? 'annotation-color-preview-invert' : ''
                }`}
                title="Custom Color"
              />
            </div>
            {/* Color Swatch Grid */}
            <div className="grid grid-cols-4 gap-2">
              {COLOR_PRESETS.map((colorHex) => (
                <button
                  key={colorHex}
                  onClick={() => {
                    onSelectColor(colorHex);
                    setShowPalette(false);
                  }}
                  className={`w-6 h-6 rounded-lg transition-all ${
                    isInvertedColorMode ? 'annotation-color-preview-invert' : ''
                  } ${
                    selectedColor.toLowerCase() === colorHex.toLowerCase()
                      ? 'ring-2 ring-blue-500 scale-105 shadow-xs'
                      : 'opacity-85 hover:opacity-100 hover:scale-105 border border-black/20'
                  }`}
                  style={{ backgroundColor: colorHex }}
                />
              ))}
            </div>

            {/* Stroke Slider */}
            <div className="pt-2.5 border-t border-[var(--border)] flex flex-col gap-1.5">
              <div className="flex justify-between text-[10.5px] text-zinc-400 font-medium">
                <span>Stroke Size</span>
                <span className="font-mono text-zinc-200">{strokeWidth}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                value={strokeWidth}
                onChange={(e) => onChangeStrokeWidth(parseInt(e.target.value, 10))}
                className="w-full accent-blue-500 cursor-pointer h-1"
              />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
