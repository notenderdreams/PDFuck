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
  Sidebar as SidebarIcon,
  HelpCircle,
  Copy,
  Camera,
  Rows,
  Square,
  Columns2,
  Layers,
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
  onOpenDashboard?: () => void;
  onOpenPdf: () => void;
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
  onCopyPageText?: () => void;
  onCopyPageJpg?: () => void;
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
  onOpenDashboard,
  onOpenPdf,
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
  onCopyPageText,
  onCopyPageJpg,
}) => {
  if (isZenMode) {
    return (
      <div className="fixed top-3 right-3 z-50 flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
        <button
          onClick={onToggleZen}
          className="btn-secondary px-2.5 py-1.5 shadow-lg"
          title="Exit Zen Mode (F)"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          <span>Exit Zen</span>
        </button>
      </div>
    );
  }

  const isInverted = theme !== 'default';

  return (
    <header className="h-11 bg-[#24242b] border-b border-[#363642] flex items-center justify-between px-3 z-30 select-none app-drag-region text-xs">
      {/* Left Section: macOS spacer, Library / Dashboard button, Sidebar toggle, Open file */}
      <div className="flex items-center gap-1.5 app-no-drag">
        {/* Window control spacer */}
        <div className="w-16 hidden sm:block" />

        {/* Back to Library Dashboard */}
        {onOpenDashboard && (
          <button
            onClick={onOpenDashboard}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1d1d23] hover:bg-[#2e2e38] border border-[#343440] text-zinc-200 font-semibold transition-all"
            title="Open PDF Library Dashboard"
          >
            <Layers className="w-3.5 h-3.5 text-zinc-300" />
            <span>Library</span>
          </button>
        )}

        {/* Sidebar Toggle */}
        <button
          onClick={onToggleSidebar}
          className={`btn-icon ${
            isSidebarOpen
              ? 'bg-[#34343f] text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Toggle Navigation Sidebar"
        >
          <SidebarIcon className="w-3.5 h-3.5" />
        </button>

        {/* Open PDF */}
        <button
          onClick={onOpenPdf}
          className="btn-secondary"
          title="Open Document (Cmd+O)"
        >
          <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
          <span>Open</span>
        </button>
      </div>

      {/* Center Section: Document Title, Page Stepper & Page Quick Copy Actions */}
      <div className="flex items-center gap-2 app-no-drag max-w-[45%]">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1d1d23] border border-[#343440] text-zinc-300">
          <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span
            className="font-medium truncate max-w-[130px] sm:max-w-[180px]"
            title={docInfo?.fileName || 'No Document'}
          >
            {docInfo?.fileName || 'No Document'}
          </span>
        </div>

        {numPages > 0 && (
          <div className="flex items-center gap-1 bg-[#1d1d23] px-2 py-0.5 rounded-md border border-[#343440]">
            <input
              type="number"
              min={1}
              max={numPages}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) onPageChange(val);
              }}
              className="w-7 text-center bg-[#2a2a33] rounded px-1 py-0.5 text-zinc-200 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
            <span className="text-zinc-500 font-mono text-[11px]">/</span>
            <span className="font-mono text-zinc-400 text-[11px] pr-1">{numPages}</span>

            {/* Quick Page Extract Action Buttons */}
            <div className="w-[1px] h-3 bg-[#343440] mx-0.5" />

            {/* Copy All Page Text */}
            <button
              onClick={onCopyPageText}
              className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-[#2c2c36] transition-all"
              title={`Copy all text from Page ${currentPage} (Cmd+Shift+C)`}
            >
              <Copy className="w-3 h-3" />
            </button>

            {/* Copy / Save Page as JPG */}
            <button
              onClick={onCopyPageJpg}
              className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-[#2c2c36] transition-all"
              title={`Copy / Save Page ${currentPage} as JPG image (Cmd+Shift+J)`}
            >
              <Camera className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Right Section: Invert, View Modes, Zoom, Search, Save */}
      <div className="flex items-center gap-1 app-no-drag">
        {/* Search */}
        <button
          onClick={onToggleSearch}
          className={`btn-icon ${
            isSearchOpen
              ? 'bg-[#34343f] text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Search in PDF (Cmd+F)"
        >
          <Search className="w-3.5 h-3.5" />
        </button>

        {/* Invert / Dark Mode */}
        <button
          onClick={onToggleInvert}
          className={`btn-secondary ${
            isInverted ? 'bg-[#34343f] text-zinc-100 border-[#484856]' : 'text-zinc-400'
          }`}
          title="Invert Colors / Dark Mode (Cmd+I)"
        >
          {isInverted ? <Sun className="w-3.5 h-3.5 text-zinc-300" /> : <Moon className="w-3.5 h-3.5" />}
          <span className="hidden lg:inline">{isInverted ? 'Inverted' : 'Invert'}</span>
        </button>

        {/* Display Settings */}
        <button
          onClick={onOpenThemeModal}
          className="btn-icon"
          title="Display Themes & Filters"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>

        {/* View Mode Segmented Control */}
        <div className="hidden lg:flex items-center bg-[#1d1d23] border border-[#343440] p-0.5 rounded-md">
          <button
            onClick={() => onChangeViewMode('continuous')}
            className={`p-1 rounded transition-all ${
              viewMode === 'continuous'
                ? 'bg-[#34343f] text-zinc-100 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Continuous Vertical View"
          >
            <Rows className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChangeViewMode('single')}
            className={`p-1 rounded transition-all ${
              viewMode === 'single'
                ? 'bg-[#34343f] text-zinc-100 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Single Page View"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChangeViewMode('spread')}
            className={`p-1 rounded transition-all ${
              viewMode === 'spread'
                ? 'bg-[#34343f] text-zinc-100 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Two-Page Spread"
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Zoom Stepper */}
        <div className="hidden xl:flex items-center bg-[#1d1d23] border border-[#343440] px-1.5 py-0.5 rounded-md font-mono text-[11px] text-zinc-300">
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
          className="btn-icon"
          title="Fullscreen Focus (F)"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {/* Shortcuts */}
        <button
          onClick={onToggleShortcuts}
          className="btn-icon"
          title="Shortcuts (?)"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>

        {/* Primary Save PDF Button */}
        <button
          onClick={onExportClick}
          className="btn-primary ml-1"
          title="Save Modified PDF (Cmd+S)"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Save PDF</span>
        </button>
      </div>
    </header>
  );
};
