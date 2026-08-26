import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
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
  Underline,
} from 'lucide-react';
import type { HighlightStyle, LineHighlightStyle, ToolType } from '../utils/types';
import { toggleHighlightStyle } from '../utils/highlightStyle';

interface ToolbarProps {
  activeTool: ToolType;
  selectedColor: string;
  isInvertedColorMode: boolean;
  strokeWidth: number;
  opacity: number;
  highlightStyle: HighlightStyle;
  lineHighlightStyle: LineHighlightStyle;
  canUndo?: boolean;
  canRedo?: boolean;
  onSelectTool: (tool: ToolType) => void;
  onSelectColor: (color: string) => void;
  onChangeStrokeWidth: (width: number) => void;
  onChangeOpacity: (opacity: number) => void;
  onChangeHighlightStyle: (style: HighlightStyle) => void;
  onChangeLineHighlightStyle: (style: LineHighlightStyle) => void;
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
  highlightStyle,
  lineHighlightStyle,
  onSelectTool,
  onSelectColor,
  onChangeStrokeWidth,
  onChangeHighlightStyle,
  onChangeLineHighlightStyle,
}) => {
  const [showPalette, setShowPalette] = useState(false);
  const [hoveredTool, setHoveredTool] = useState<ToolType | 'color' | null>(null);
  const paletteRef = useRef<HTMLDivElement | null>(null);

  // Position for smooth sliding active circle indicator
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    opacity: number;
  }>({
    left: 0,
    top: 0,
    width: 34,
    height: 34,
    opacity: 0,
  });

  const toolRefs = useRef<Map<ToolType, HTMLDivElement>>(new Map());

  // Measure and update the sliding active circle
  useLayoutEffect(() => {
    const updateIndicator = () => {
      const activeEl = toolRefs.current.get(activeTool);
      if (activeEl) {
        setIndicatorStyle({
          left: activeEl.offsetLeft,
          top: activeEl.offsetTop,
          width: activeEl.offsetWidth,
          height: activeEl.offsetHeight,
          opacity: 1,
        });
      } else {
        setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
      }
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeTool]);

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
    { id: 'select', icon: MousePointer, label: 'Pointer', shortcut: 'V' },
    { id: 'highlight-line', icon: PenLine, label: 'Line Highlight', shortcut: 'L / U' },
    { id: 'highlight-pen', icon: Highlighter, label: 'Freehand', shortcut: 'H' },
    { id: 'highlight-rect', icon: Square, label: 'Area Box', shortcut: 'R' },
    { id: 'pen', icon: PenTool, label: 'Pen', shortcut: 'P' },
    { id: 'snip', icon: Crop, label: 'Snip to AI', shortcut: 'C' },
    { id: 'ai-box', icon: ScanSearch, label: 'Explain Region', shortcut: 'A' },
    { id: 'text', icon: Type, label: 'Text Note', shortcut: 'T' },
    { id: 'eraser', icon: Eraser, label: 'Eraser', shortcut: 'E' },
  ];

  return (
    <nav
      aria-label="Annotation Dock"
      className="macos-annotation-dock select-none"
    >
      {/* Smooth Sliding Active Circle Indicator */}
      <div
        className="macos-dock-sliding-indicator"
        style={{
          transform: `translate3d(${indicatorStyle.left}px, ${indicatorStyle.top}px, 0)`,
          width: `${indicatorStyle.width}px`,
          height: `${indicatorStyle.height}px`,
          opacity: indicatorStyle.opacity,
        }}
      />

      {/* Tool Buttons with Mac Dock Magnification & Tooltips */}
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        const isHovered = hoveredTool === tool.id;

        return (
          <div
            key={tool.id}
            ref={(el) => {
              if (el) toolRefs.current.set(tool.id, el);
              else toolRefs.current.delete(tool.id);
            }}
            className="relative flex items-center justify-center"
          >
            {/* Glossy Dock Tooltip */}
            {isHovered && !showPalette && (
              <div className="macos-dock-tooltip">
                <span>{tool.label}</span>
                <span className="macos-dock-badge">{tool.shortcut}</span>
              </div>
            )}

            <button
              onClick={() => onSelectTool(tool.id)}
              onMouseEnter={() => setHoveredTool(tool.id)}
              onMouseLeave={() => setHoveredTool(null)}
              className={`macos-dock-item z-10 ${isActive ? 'macos-dock-item-active' : ''}`}
              aria-label={tool.label}
              aria-pressed={isActive}
            >
              <Icon className="w-4 h-4" />
            </button>
          </div>
        );
      })}

      {/* Glossy Etched Glass Divider */}
      <div className="macos-dock-divider z-10" aria-hidden="true" />

      {/* Color Swatch Orb & Floating Palette */}
      <div className="relative flex items-center justify-center z-10" ref={paletteRef}>
        {hoveredTool === 'color' && !showPalette && (
          <div className="macos-dock-tooltip">
            <span>Color & Stroke</span>
          </div>
        )}

        <button
          onClick={() => {
            setShowPalette(!showPalette);
            setHoveredTool(null);
          }}
          onMouseEnter={() => setHoveredTool('color')}
          onMouseLeave={() => setHoveredTool(null)}
          className="macos-dock-item"
          aria-label="Select Color and Stroke Size"
          aria-expanded={showPalette}
        >
          <span
            className={`macos-color-orb ${
              isInvertedColorMode ? 'annotation-color-preview-invert' : ''
            }`}
            style={{ backgroundColor: selectedColor }}
          />
        </button>

        {/* Glossy Frosted Glass Palette Popover */}
        {showPalette && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 p-3.5 rounded-2xl bg-[var(--popover)]/95 border border-white/20 backdrop-blur-2xl shadow-2xl flex flex-col gap-3 min-w-[200px] animate-slide-up z-50">
            <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              <span>Swatches</span>
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => onSelectColor(e.target.value)}
                className={`w-5 h-5 rounded-full border-0 bg-transparent cursor-pointer ${
                  isInvertedColorMode ? 'annotation-color-preview-invert' : ''
                }`}
                title="Custom Color Picker"
              />
            </div>

            {/* Color Swatch Grid with Glossy Chips */}
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
                      ? 'ring-2 ring-blue-500 scale-110 shadow-md'
                      : 'opacity-85 hover:opacity-100 hover:scale-108 border border-black/20'
                  }`}
                  style={{ backgroundColor: colorHex }}
                />
              ))}
            </div>

            {/* Stroke Slider */}
            <div className="pt-2.5 border-t border-[var(--border)] flex flex-col gap-1.5">
              <div className="flex justify-between text-[10.5px] text-zinc-400 font-medium">
                <span>Stroke Size</span>
                <span className="font-mono text-zinc-200 font-semibold">{strokeWidth}px</span>
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

            <div className="pt-2.5 border-t border-[var(--border)] flex flex-col gap-1.5">
              <span className="text-[10.5px] text-zinc-400 font-medium">Highlight Style</span>
              <div
                className={`grid gap-1.5 ${activeTool === 'highlight-rect' || activeTool === 'highlight-line' ? 'grid-cols-1' : 'grid-cols-2'}`}
                role="group"
                aria-label="Highlight style"
              >
                {activeTool !== 'highlight-line' && (
                  <button
                    type="button"
                    onClick={() => onChangeHighlightStyle(toggleHighlightStyle(highlightStyle, 'stroke'))}
                    className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[10.5px] font-medium transition-colors ${
                      highlightStyle === 'stroke'
                        ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40'
                        : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    }`}
                    aria-pressed={highlightStyle === 'stroke'}
                    title="Draw new area highlights as fully opaque outlines"
                  >
                    <Square className="w-3.5 h-3.5" />
                    Stroke
                  </button>
                )}
                {activeTool !== 'highlight-rect' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeTool === 'highlight-line') {
                        onChangeLineHighlightStyle(
                          lineHighlightStyle === 'underline' ? 'highlight' : 'underline'
                        );
                      } else {
                        onChangeHighlightStyle(toggleHighlightStyle(highlightStyle, 'underline'));
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[10.5px] font-medium transition-colors ${
                      (activeTool === 'highlight-line'
                        ? lineHighlightStyle === 'underline'
                        : highlightStyle === 'underline')
                        ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40'
                        : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    }`}
                    aria-pressed={
                      activeTool === 'highlight-line'
                        ? lineHighlightStyle === 'underline'
                        : highlightStyle === 'underline'
                    }
                    title="Draw new highlights as fully opaque underlines"
                  >
                    <Underline className="w-3.5 h-3.5" />
                    Underline
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
