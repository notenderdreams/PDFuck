import React from 'react';
import {
  FolderOpen,
  Download,
  Moon,
  Sun,
  Search,
  Maximize2,
  Minimize2,
  FileText,
  SlidersHorizontal,
  Layers,
  HelpCircle,
  Sparkles,
  Rows,
  Square,
  Columns2,
  ChevronDown,
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
      <div className="fixed top-3 right-3 z-50 flex items-center gap-2 opacity-40 hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={onToggleZen}
          className="p-2 rounded-lg bg-[#23232a] border border-[#3c3c4a] text-zinc-300 hover:text-white shadow-xl"
          title="Exit Zen Mode (F)"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const isInverted = theme !== 'default';

  return (
    <header className="h-12 bg-[#25252c] border-b border-[#363642] flex items-center justify-between px-3 z-30 select-none app-drag-region text-xs">
      {/* Left Studio Section: Traffic space, Sidebar rail toggle, Open file */}
      <div className="flex items-center gap-1.5 app-no-drag">
        {/* macOS Traffic lights spacer */}
        <div className="w-16 hidden sm:block" />

        {/* Sidebar Toggle Button */}
        <button
          onClick={onToggleSidebar}
          className={`p-1.5 rounded-md border transition-all ${
            isSidebarOpen
              ? 'bg-[#353542] border-[#48485a] text-white shadow-xs'
              : 'bg-[#202026] border-[#2e2e38] text-zinc-400 hover:text-zinc-200 hover:bg-[#2c2c36]'
          }`}
          title="Studio Navigator (Thumbnails, Outline, Annotations)"
        >
          <Layers className="w-3.5 h-3.5" />
        </button>

        {/* Open PDF */}
        <button
          onClick={onOpenPdf}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2b2b34] hover:bg-[#343440] border border-[#3b3b48] text-zinc-200 hover:text-white transition-all font-medium active:scale-98"
          title="Open Document (Cmd+O)"
        >
          <FolderOpen className="w-3.5 h-3.5 text-[#0099ff]" />
          <span>Open</span>
        </button>

        {/* Sample Doc */}
        <button
          onClick={onLoadSample}
          className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#23232a] hover:bg-[#2e2e38] border border-[#363644] text-zinc-300 hover:text-white transition-all"
          title="Load Sample Document"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Sample</span>
        </button>
      </div>

      {/* Center Studio Section: Document Breadcrumb & Page Stepper */}
      <div className="flex items-center gap-2 app-no-drag max-w-[42%]">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1d1d24] border border-[#2e2e3a] text-zinc-300">
          <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span
            className="font-medium truncate max-w-[160px] sm:max-w-[220px]"
            title={docInfo?.fileName || 'No Document'}
          >
            {docInfo?.fileName || 'No Document'}
          </span>
        </div>

        {numPages > 0 && (
          <div className="flex items-center gap-1 bg-[#1d1d24] px-2 py-0.5 rounded-md border border-[#2e2e3a]">
            <input
              type="number"
              min={1}
              max={numPages}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) onPageChange(val);
              }}
              className="w-8 text-center bg-[#292934] rounded px-1 py-0.5 text-zinc-200 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-[#0088ff]"
            />
            <span className="text-zinc-500 font-mono text-[11px]">/</span>
            <span className="font-mono text-zinc-400 text-[11px] pr-0.5">{numPages}</span>
          </div>
        )}
      </div>

      {/* Right Studio Section: Invert Mode, View Modes, Zoom, Search, Save */}
      <div className="flex items-center gap-1.5 app-no-drag">
        {/* Search */}
        <button
          onClick={onToggleSearch}
          className={`p-1.5 rounded-md border transition-all ${
            isSearchOpen
              ? 'bg-[#0088ff]/20 border-[#0088ff]/50 text-[#38bdf8]'
              : 'bg-[#202026] border-[#2e2e38] text-zinc-400 hover:text-zinc-200 hover:bg-[#2c2c36]'
          }`}
          title="Search in PDF (Cmd+F)"
        >
          <Search className="w-3.5 h-3.5" />
        </button>

        {/* Invert / Dark Mode Pill */}
        <button
          onClick={onToggleInvert}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all ${
            isInverted
              ? 'bg-[#8b5cf6]/20 border-[#8b5cf6]/50 text-purple-300'
              : 'bg-[#202026] border-[#2e2e38] text-zinc-400 hover:text-zinc-200 hover:bg-[#2c2c36]'
          }`}
          title="Invert Colors / Dark Mode (Cmd+I)"
        >
          {isInverted ? <Sun className="w-3.5 h-3.5 text-purple-400" /> : <Moon className="w-3.5 h-3.5" />}
          <span className="font-medium hidden lg:inline">
            {isInverted ? 'Inverted' : 'Invert'}
          </span>
        </button>

        {/* Theme Settings Modal */}
        <button
          onClick={onOpenThemeModal}
          className="p-1.5 rounded-md bg-[#202026] hover:bg-[#2c2c36] border border-[#2e2e38] text-zinc-400 hover:text-zinc-200 transition-all"
          title="Display Themes & Filters"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>

        {/* View Mode Segmented Control (Unity / Affinity style) */}
        <div className="hidden lg:flex items-center bg-[#1d1d24] p-0.5 rounded-md border border-[#2e2e3a]">
          <button
            onClick={() => onChangeViewMode('continuous')}
            className={`p-1 rounded transition-all ${
              viewMode === 'continuous'
                ? 'bg-[#353544] text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Continuous Vertical Layout"
          >
            <Rows className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChangeViewMode('single')}
            className={`p-1 rounded transition-all ${
              viewMode === 'single'
                ? 'bg-[#353544] text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Single Page Slide"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChangeViewMode('spread')}
            className={`p-1 rounded transition-all ${
              viewMode === 'spread'
                ? 'bg-[#353544] text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Two-Page Spread (Book Mode)"
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Zoom Stepper */}
        <div className="hidden xl:flex items-center bg-[#1d1d24] px-1.5 py-0.5 rounded-md border border-[#2e2e3a] font-mono text-[11px] text-zinc-300">
          <button
            onClick={() => onChangeZoom(Math.max(0.4, zoom - 0.15))}
            className="hover:text-white px-1 text-zinc-400"
            title="Zoom Out (Cmd -)"
          >
            -
          </button>
          <span className="w-9 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => onChangeZoom(Math.min(3.0, zoom + 0.15))}
            className="hover:text-white px-1 text-zinc-400"
            title="Zoom In (Cmd +)"
          >
            +
          </button>
        </div>

        {/* Zen Mode */}
        <button
          onClick={onToggleZen}
          className="p-1.5 rounded-md bg-[#202026] hover:bg-[#2c2c36] border border-[#2e2e38] text-zinc-400 hover:text-zinc-200 transition-all"
          title="Fullscreen Focus (F)"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {/* Shortcuts */}
        <button
          onClick={onToggleShortcuts}
          className="p-1.5 rounded-md bg-[#202026] hover:bg-[#2c2c36] border border-[#2e2e38] text-zinc-400 hover:text-zinc-200 transition-all"
          title="Shortcuts (?)"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>

        {/* Primary Save / Export Button (Affinity Studio Blue) */}
        <button
          onClick={onExportClick}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#0080f0] hover:bg-[#0070dc] text-white font-semibold shadow-sm transition-all active:scale-98 ml-0.5"
          title="Export Modified PDF (Cmd+S)"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Save PDF</span>
        </button>
      </div>
    </header>
  );
};
