import React, { useState } from 'react';
import {
  MousePointer,
  Highlighter,
  Square,
  PenTool,
  Image as ImageIcon,
  Type,
  Eraser,
  Stamp,
  Palette,
} from 'lucide-react';
import type { ToolType } from '../utils/types';

interface ToolbarProps {
  activeTool: ToolType;
  selectedColor: string;
  strokeWidth: number;
  opacity: number;
  canUndo?: boolean;
  canRedo?: boolean;
  onSelectTool: (tool: ToolType) => void;
  onSelectColor: (color: string) => void;
  onChangeStrokeWidth: (width: number) => void;
  onChangeOpacity: (opacity: number) => void;
  onAttachImageClick: () => void;
  onOpenStampPicker: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClearPageAnnotations?: () => void;
}

const COLOR_PRESETS = [
  '#ffe600', // Yellow
  '#00f2fe', // Cyan
  '#ff007f', // Pink
  '#39ff14', // Green
  '#ff7700', // Orange
  '#a855f7', // Purple
  '#ef4444', // Red
  '#3b82f6', // Blue
];

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  selectedColor,
  strokeWidth,
  opacity,
  onSelectTool,
  onSelectColor,
  onChangeStrokeWidth,
  onChangeOpacity,
  onAttachImageClick,
  onOpenStampPicker,
}) => {
  const [showPalette, setShowPalette] = useState(false);

  const tools: { id: ToolType; icon: React.FC<{ className?: string }>; label: string; shortcut: string }[] = [
    { id: 'select', icon: MousePointer, label: 'Select (V)', shortcut: 'V' },
    { id: 'highlight-pen', icon: Highlighter, label: 'Highlighter (H)', shortcut: 'H' },
    { id: 'highlight-rect', icon: Square, label: 'Area Box (R)', shortcut: 'R' },
    { id: 'pen', icon: PenTool, label: 'Pen (P)', shortcut: 'P' },
    { id: 'image', icon: ImageIcon, label: 'Image (I)', shortcut: 'I' },
    { id: 'text', icon: Type, label: 'Note (T)', shortcut: 'T' },
    { id: 'eraser', icon: Eraser, label: 'Eraser (E)', shortcut: 'E' },
  ];

  const handleToolClick = (toolId: ToolType) => {
    if (toolId === 'image') {
      onSelectTool('image');
      onAttachImageClick();
    } else {
      onSelectTool(toolId);
    }
  };

  return (
    <nav
      aria-label="Annotation Tools"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 px-2 py-1.5 rounded-full bg-[#121216]/95 border border-white/15 backdrop-blur-2xl shadow-[0_12px_32px_rgba(0,0,0,0.5)] select-none animate-slide-up"
    >
      {/* Core Tool Buttons */}
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => handleToolClick(tool.id)}
            className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 ${
              isActive
                ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(59,130,246,0.5)] scale-105'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/10'
            }`}
            title={tool.label}
          >
            <Icon className="w-3.5 h-3.5" />
            {isActive && (
              <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-white animate-pulse" />
            )}
          </button>
        );
      })}

      {/* Preset Stamps Quick Trigger */}
      <button
        onClick={onOpenStampPicker}
        className="flex items-center justify-center w-8 h-8 rounded-full text-zinc-400 hover:text-emerald-300 hover:bg-white/10 transition-all"
        title="Stamps & Seals"
      >
        <Stamp className="w-3.5 h-3.5 text-emerald-400" />
      </button>

      {/* Minimalist Divider */}
      <div className="w-[1px] h-4 bg-white/15 mx-0.5" />

      {/* Quick Color Dot & Settings */}
      <div className="relative">
        <button
          onClick={() => setShowPalette(!showPalette)}
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-all"
          title="Change Color & Stroke"
        >
          <span
            className="w-4 h-4 rounded-full ring-2 ring-white/30 shadow-sm transition-transform hover:scale-110"
            style={{ backgroundColor: selectedColor }}
          />
        </button>

        {/* Compact Flyout for Color & Stroke */}
        {showPalette && (
          <div className="absolute bottom-11 left-1/2 -translate-x-1/2 p-3 rounded-2xl bg-[#18181f]/98 border border-white/20 backdrop-blur-2xl shadow-2xl flex flex-col gap-2.5 min-w-[190px] animate-slide-up z-50">
            <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              <span>Color</span>
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => onSelectColor(e.target.value)}
                className="w-4 h-4 rounded border-0 bg-transparent cursor-pointer"
                title="Custom Color"
              />
            </div>
            {/* Color circles */}
            <div className="grid grid-cols-4 gap-2">
              {COLOR_PRESETS.map((colorHex) => (
                <button
                  key={colorHex}
                  onClick={() => {
                    onSelectColor(colorHex);
                    setShowPalette(false);
                  }}
                  className={`w-6 h-6 rounded-full transition-all ${
                    selectedColor.toLowerCase() === colorHex.toLowerCase()
                      ? 'ring-2 ring-white scale-110 shadow-md'
                      : 'opacity-80 hover:opacity-100 hover:scale-105'
                  }`}
                  style={{ backgroundColor: colorHex }}
                />
              ))}
            </div>

            {/* Stroke & Opacity Slider */}
            <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
              <div className="flex justify-between text-[10px] text-zinc-400">
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
