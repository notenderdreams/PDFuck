import React from 'react';
import {
  ArrowLeft,
  Download,
  Moon,
  Sun,
  Search,
  Maximize2,
  Minimize2,
  FileText,
  SlidersHorizontal,
  HelpCircle,
  Copy,
  Camera,
  Rows,
  Square,
  Columns2,
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
  isSearchOpen: boolean;
  annotationCount?: number;
  saveStatus?: 'saved' | 'saving';
  onOpenDashboard?: () => void;
  onExportClick: () => void;
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
  isSearchOpen,
  annotationCount,
  saveStatus,
  onOpenDashboard,
  onExportClick,
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
  const [pageInputText, setPageInputText] = React.useState<string>(String(currentPage));

  React.useEffect(() => {
    setPageInputText(String(currentPage));
  }, [currentPage]);

  const handlePageInputCommit = () => {
    const val = parseInt(pageInputText, 10);
    if (!isNaN(val) && val >= 1 && val <= numPages) {
      onPageChange(val);
    } else {
      setPageInputText(String(currentPage));
    }
  };

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

  const isInverted = ['invert', 'oled', 'nord', 'matrix'].includes(theme);

  return (
    <header className="macos-titlebar reader-titlebar h-12 px-3 z-30 select-none app-drag-region text-xs">
      <div className="reader-titlebar-left flex items-center gap-2 app-no-drag min-w-0">
        <div className="macos-window-controls-spacer hidden sm:block" />
        {onOpenDashboard && (
          <button onClick={onOpenDashboard} className="macos-topbar-icon" title="Back to Library">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="reader-titlebar-center app-no-drag min-w-0">
        <div className="macos-document-title reader-document-title min-w-0">
          <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
          <div className="min-w-0 leading-tight">
            <span
              className="block font-semibold truncate text-[12px]"
              title={docInfo?.fileName || 'No Document'}
            >
              {docInfo?.fileName || 'No Document'}
            </span>
            <span className="block truncate text-[10px] text-zinc-500">
              {numPages > 0 ? `Page ${currentPage} of ${numPages}` : 'Ready to read'}
              {annotationCount !== undefined && annotationCount > 0 &&
                ` · ${saveStatus === 'saving' ? 'Saving notes…' : `${annotationCount} note${annotationCount === 1 ? '' : 's'}`}`}
            </span>
          </div>
        </div>
        {numPages > 0 && (
          <div className="macos-toolbar-group macos-page-control flex items-center gap-1 px-1.5">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pageInputText}
              onChange={(e) => setPageInputText(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePageInputCommit();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onBlur={handlePageInputCommit}
              style={{
                width: `${Math.max(28, String(pageInputText || numPages).length * 8 + 14)}px`,
              }}
              className="text-center bg-transparent rounded px-1 py-0.5 text-zinc-200 font-mono text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-zinc-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-zinc-500 font-mono text-[11px]">/</span>
            <span className="font-mono text-zinc-400 text-[11px] pr-1">{numPages}</span>
            <div className="macos-toolbar-group-separator" />
            <button
              onClick={onCopyPageText}
              className="macos-reader-inline-action"
              title={`Copy all text from Page ${currentPage} (Cmd+Shift+C)`}
            >
              <Copy className="w-3 h-3" />
            </button>
            <button
              onClick={onCopyPageJpg}
              className="macos-reader-inline-action"
              title={`Copy / Save Page ${currentPage} as JPG image (Cmd+Shift+J)`}
            >
              <Camera className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      <div className="reader-titlebar-actions flex items-center gap-1.5 app-no-drag justify-self-end">
        <div className="reader-display-actions flex items-center gap-2">
          <button
            onClick={onToggleSearch}
            className={`macos-topbar-icon ${isSearchOpen ? 'text-[var(--primary)]' : ''}`}
            title="Search in PDF (Cmd+F)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleInvert}
            className={`macos-topbar-icon ${isInverted ? 'text-[var(--primary)]' : ''}`}
            title={isInverted ? 'Use light appearance (Cmd+I)' : 'Use dark appearance (Cmd+I)'}
          >
            {isInverted ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onOpenThemeModal}
            className="macos-topbar-icon"
            title="Display Themes & Filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="reader-toolbar-divider hidden lg:block" aria-hidden="true" />

        <div className="macos-toolbar-group macos-reader-segmented hidden lg:flex items-center">
          <button
            onClick={() => onChangeViewMode('continuous')}
            className={`p-1 rounded transition-all ${
              viewMode === 'continuous'
                ? 'reader-view-mode-active'
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
                ? 'reader-view-mode-active'
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
                ? 'reader-view-mode-active'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Two-Page Spread"
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="reader-toolbar-divider hidden lg:block" aria-hidden="true" />

        <div className="macos-toolbar-group macos-reader-zoom reader-secondary-actions hidden xl:flex items-center px-1 font-mono text-[11px] text-zinc-300">
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

        <div className="macos-toolbar-group reader-secondary-actions hidden xl:flex">
          <button onClick={onToggleZen} className="macos-toolbar-group-icon" title="Fullscreen Focus (F)">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onToggleShortcuts} className="macos-toolbar-group-icon" title="Shortcuts (?)">
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Primary Save PDF Button */}
        <button
          onClick={onExportClick}
          className="macos-reader-control macos-reader-primary"
          title="Save Modified PDF (Cmd+S)"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Save PDF</span>
        </button>
      </div>
    </header>
  );
};
