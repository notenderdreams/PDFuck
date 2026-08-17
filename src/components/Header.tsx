import React from 'react';
import {
  FolderOpen,
  Download,
  Moon,
  Sun,
  Palette,
  Search,
  Maximize2,
  Minimize2,
  FileText,
  SlidersHorizontal,
  Layers,
  HelpCircle,
  Sparkles,
  BookOpen,
  Eye,
  Rows,
  Square,
  Columns2
} from 'lucide-react';
import type { DocumentInfo, ReadingTheme, ViewMode } from '../utils/types';

interface HeaderProps {
  docInfo: DocumentInfo | null;
  currentPage: number;
  numPages: number;
  zoom: number;
  viewMode: ViewMode;
  theme: ReadingTheme;
  isZenMode: boolean;
  isSidebarOpen: boolean;
  isSearchOpen: boolean;
  onOpenPdf: () => void;
  onLoadSample: () => void;
  onExportClick: () => void;
  onToggleSidebar: () => void;
  onToggleSearch: () => void;
  onToggleInvert: () => void;
  onOpenThemeModal: () => void;
  onToggleZen: () => void;
  onToggleShortcuts: () => void;
  onChangeViewMode: (mode: ViewMode) => void;
  onChangeZoom: (newZoom: number) => void;
  onPageChange: (page: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  docInfo,
  currentPage,
  numPages,
  zoom,
  viewMode,
  theme,
  isZenMode,
  isSidebarOpen,
  isSearchOpen,
  onOpenPdf,
  onLoadSample,
  onExportClick,
  onToggleSidebar,
  onToggleSearch,
  onToggleInvert,
  onOpenThemeModal,
  onToggleZen,
  onToggleShortcuts,
  onChangeViewMode,
  onChangeZoom,
  onPageChange,
}) => {
  if (isZenMode) {
    return (
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 opacity-30 hover:opacity-100 transition-opacity duration-300">
        <button
          onClick={onToggleZen}
          className="p-2.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-white/80 hover:text-white hover:bg-black/90 shadow-xl"
          title="Exit Zen Mode (F)"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const isInverted = theme !== 'default';

  return (
    <header className="h-14 bg-[#0e0e12]/90 border-b border-white/[0.08] backdrop-blur-xl flex items-center justify-between px-4 z-30 select-none app-drag-region">
      {/* Left: macOS Window Spacing & Sidebar / File Actions */}
      <div className="flex items-center gap-2.5 app-no-drag">
        {/* Leave space for native macOS traffic lights if on Mac */}
        <div className="w-16 hidden sm:block" />

        {/* Sidebar Toggle */}
        <button
          onClick={onToggleSidebar}
          className={`p-2 rounded-xl border transition-all duration-200 ${
            isSidebarOpen
              ? 'bg-white/15 border-white/20 text-white shadow-inner'
              : 'bg-white/5 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10'
          }`}
          title="Toggle Navigation Sidebar"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Open PDF button */}
        <button
          onClick={onOpenPdf}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-zinc-200 hover:text-white transition-all duration-200 shadow-sm active:scale-95"
          title="Open PDF Document (Cmd+O)"
        >
          <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
          <span>Open PDF</span>
        </button>

        {/* Load Demo / Sample Document */}
        <button
          onClick={onLoadSample}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border border-blue-500/20 text-xs font-medium text-blue-300 hover:text-blue-200 transition-all duration-200 shadow-sm"
          title="Load Interactive Sample PDF"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Sample PDF</span>
        </button>
      </div>

      {/* Center: Document Title & Page Switcher */}
      <div className="flex items-center gap-3 app-no-drag max-w-[40%]">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] backdrop-blur-md">
          <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span
            className="text-xs font-medium text-zinc-300 truncate max-w-[180px] sm:max-w-[240px]"
            title={docInfo?.fileName || 'No Document'}
          >
            {docInfo?.fileName || 'PDFuck — No Document Loaded'}
          </span>
        </div>

        {numPages > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/[0.05]">
            <input
              type="number"
              min={1}
              max={numPages}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) onPageChange(val);
              }}
              className="w-9 text-center bg-white/10 rounded px-1 py-0.5 text-zinc-200 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-zinc-500 font-mono">/</span>
            <span className="font-mono text-zinc-400">{numPages}</span>
          </div>
        )}
      </div>

      {/* Right: Color Inversion, Reading Mode, View Modes, Zoom, Export */}
      <div className="flex items-center gap-2 app-no-drag">
        {/* Search button */}
        <button
          onClick={onToggleSearch}
          className={`p-2 rounded-xl border transition-all duration-200 ${
            isSearchOpen
              ? 'bg-blue-500/20 border-blue-500/30 text-blue-300'
              : 'bg-white/5 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10'
          }`}
          title="Search Text (Cmd+F)"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Quick Color Invert Button */}
        <button
          onClick={onToggleInvert}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all duration-200 ${
            isInverted
              ? 'bg-purple-500/20 border-purple-500/30 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
              : 'bg-white/5 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10'
          }`}
          title="Quick Invert Colors (Cmd+I)"
        >
          {isInverted ? <Sun className="w-3.5 h-3.5 text-purple-400" /> : <Moon className="w-3.5 h-3.5" />}
          <span className="text-xs font-medium hidden lg:inline">
            {isInverted ? 'Inverted' : 'Invert'}
          </span>
        </button>

        {/* Reading Themes & Filter Settings */}
        <button
          onClick={onOpenThemeModal}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-400 hover:text-zinc-200 transition-all duration-200"
          title="Reading Themes & Invert Settings"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        {/* View Mode Switcher (Continuous / Single / Spread) */}
        <div className="hidden lg:flex items-center bg-white/[0.04] p-0.5 rounded-xl border border-white/[0.06]">
          <button
            onClick={() => onChangeViewMode('continuous')}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'continuous'
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Continuous Scroll"
          >
            <Rows className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChangeViewMode('single')}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'single'
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Single Page Slide"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChangeViewMode('spread')}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'spread'
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Two-Page Spread (Book Mode)"
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Zoom Selector */}
        <div className="hidden xl:flex items-center gap-1 bg-white/[0.04] px-2 py-1 rounded-xl border border-white/[0.06] text-xs font-mono text-zinc-300">
          <button
            onClick={() => onChangeZoom(Math.max(0.4, zoom - 0.15))}
            className="hover:text-white px-1"
            title="Zoom Out (Cmd -)"
          >
            -
          </button>
          <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => onChangeZoom(Math.min(3.0, zoom + 0.15))}
            className="hover:text-white px-1"
            title="Zoom In (Cmd +)"
          >
            +
          </button>
        </div>

        {/* Zen Mode Button */}
        <button
          onClick={onToggleZen}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-400 hover:text-zinc-200 transition-all duration-200"
          title="Fullscreen Focus / Zen Mode (F)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Shortcuts Help */}
        <button
          onClick={onToggleShortcuts}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-400 hover:text-zinc-200 transition-all duration-200"
          title="Keyboard Shortcuts (?)"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Primary Save & Export Button */}
        <button
          onClick={onExportClick}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-[0_2px_12px_rgba(59,130,246,0.3)] transition-all duration-200 active:scale-95 ml-1"
          title="Export / Save Modified PDF (Cmd+S)"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Save PDF</span>
        </button>
      </div>
    </header>
  );
};
