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
  '#00d4ff', // Studio Cyan
  '#ff2d75', // Neon Pink
  '#00e676', // Emerald Green
  '#ff9100', // Amber Orange
  '#a855f7', // Violet
  '#ff3b30', // Red
  '#0088ff', // Affinity Blue
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
    { id: 'select', icon: MousePointer, label: 'Pointer Tool (V)', shortcut: 'V' },
    { id: 'highlight-pen', icon: Highlighter, label: 'Highlighter (H)', shortcut: 'H' },
    { id: 'highlight-rect', icon: Square, label: 'Highlight Area (R)', shortcut: 'R' },
    { id: 'pen', icon: PenTool, label: 'Vector Pen (P)', shortcut: 'P' },
    { id: 'image', icon: ImageIcon, label: 'Attach Image (I)', shortcut: 'I' },
    { id: 'text', icon: Type, label: 'Text Note (T)', shortcut: 'T' },
    { id: 'eraser', icon: Eraser, label: 'Eraser Tool (E)', shortcut: 'E' },
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
      aria-label="Studio Tool Dock"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 p-1 rounded-lg bg-[#25252c] border border-[#383846] shadow-[0_8px_30px_rgba(0,0,0,0.55)] select-none animate-slide-up"
    >
      {/* Studio Tool Buttons */}
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => handleToolClick(tool.id)}
            className={`flex items-center justify-center w-7.5 h-7.5 rounded-md transition-all ${
              isActive
                ? 'bg-[#0080f0] text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#32323c]'
            }`}
            title={tool.label}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}

      {/* Preset Stamps Quick Trigger */}
      <button
        onClick={onOpenStampPicker}
        className="flex items-center justify-center w-7.5 h-7.5 rounded-md text-zinc-400 hover:text-emerald-300 hover:bg-[#32323c] transition-all"
        title="Preset Stamps & Badges"
      >
        <Stamp className="w-4 h-4 text-emerald-400" />
      </button>

      {/* Precision Inset Divider */}
      <div className="w-[1px] h-4 bg-[#383846] mx-0.5" />

      {/* Color Swatch & Stroke Well */}
      <div className="relative">
        <button
          onClick={() => setShowPalette(!showPalette)}
          className="flex items-center justify-center w-7.5 h-7.5 rounded-md hover:bg-[#32323c] transition-all p-1"
          title="Color Swatches & Stroke"
        >
          <span
            className="w-4 h-4 rounded-full border border-white/20 shadow-xs"
            style={{ backgroundColor: selectedColor }}
          />
        </button>

        {/* Studio Color & Stroke Flyout */}
        {showPalette && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 p-3 rounded-lg bg-[#25252c] border border-[#3c3c4a] shadow-2xl flex flex-col gap-2.5 min-w-[190px] animate-slide-up z-50">
            <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              <span>Swatches</span>
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => onSelectColor(e.target.value)}
                className="w-4 h-4 rounded border-0 bg-transparent cursor-pointer"
                title="Custom Color"
              />
            </div>
            {/* Color Swatch Grid */}
            <div className="grid grid-cols-4 gap-1.5">
              {COLOR_PRESETS.map((colorHex) => (
                <button
                  key={colorHex}
                  onClick={() => {
                    onSelectColor(colorHex);
                    setShowPalette(false);
                  }}
                  className={`w-6 h-6 rounded-md transition-all ${
                    selectedColor.toLowerCase() === colorHex.toLowerCase()
                      ? 'ring-2 ring-white scale-105 shadow-sm'
                      : 'opacity-80 hover:opacity-100 hover:scale-105 border border-black/20'
                  }`}
                  style={{ backgroundColor: colorHex }}
                />
              ))}
            </div>

            {/* Stroke Slider */}
            <div className="pt-2 border-t border-[#343440] flex flex-col gap-1.5">
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
                className="w-full accent-[#0080f0] cursor-pointer h-1"
              />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
