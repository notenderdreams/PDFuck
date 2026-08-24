import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FolderPlus,
  FolderOpen,
  FileText,
  Search,
  Star,
  Clock,
  RefreshCw,
  Trash2,
  BookOpen,
  ArrowRight,
  HardDrive,
  Folder,
  Moon,
  Sun,
  ChevronDown,
  Check,
  ArrowUpDown,
} from 'lucide-react';
import type { DashboardPdfItem, SavedDirectory } from '../utils/types';
import {
  isTauri,
  tauriSelectDirectory,
  tauriScanDirectoryPdfs,
  tauriGetDefaultDirectories,
  tauriReadFile,
  tauriOpenPdf,
  handleTitlebarMouseDown,
} from '../utils/tauriBridge';
import {
  loadSavedDirectories,
  saveSavedDirectories,
  loadRecentDocs,
  recordRecentDoc,
  loadFavorites,
  toggleFavorite as toggleStorageFavorite,
  loadLibraryFilter,
  saveLibraryFilter,
  loadLibrarySort,
  saveLibrarySort,
} from '../utils/storage';

interface DashboardProps {
  onOpenPdf: (data: Uint8Array, fileName: string, filePath?: string, initialPageNumber?: number) => Promise<boolean>;
  onSwitchToReader: () => void;
  hasActiveDoc: boolean;
  activeDocName?: string;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
}

type FilterTab = 'all' | 'recent' | 'favorites' | string; // string for specific directory ID
type SortOption = 'recent' | 'name' | 'size';

const SORT_OPTIONS: { value: SortOption; label: string; icon: React.FC<{ className?: string }> }[] = [
  { value: 'recent', label: 'Recently opened', icon: Clock },
  { value: 'name', label: 'File name', icon: FileText },
  { value: 'size', label: 'File size', icon: HardDrive },
];

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenPdf,
  onSwitchToReader,
  hasActiveDoc,
  activeDocName,
  isDarkTheme,
  onToggleTheme,
}) => {
  const [directories, setDirectories] = useState<SavedDirectory[]>(() => loadSavedDirectories());
  const [pdfItems, setPdfItems] = useState<DashboardPdfItem[]>([]);
  const [recentDocs, setRecentDocs] = useState<DashboardPdfItem[]>(() => loadRecentDocs());
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadFavorites());
  const [activeFilter, setActiveFilter] = useState<FilterTab>(() => loadLibraryFilter());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>(() => loadLibrarySort());
  const [isScanning, setIsScanning] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  // Persist active filter & selected folder tab
  useEffect(() => {
    saveLibraryFilter(activeFilter);
  }, [activeFilter]);

  // Persist library sorting preference
  useEffect(() => {
    saveLibrarySort(sortBy);
  }, [sortBy]);

  useEffect(() => {
    if (!isSortOpen) return;

    const closeSortMenu = (event: MouseEvent) => {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSortOpen(false);
    };

    document.addEventListener('mousedown', closeSortMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeSortMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isSortOpen]);

  // Auto-scan all saved directories
  const scanAllDirectories = useCallback(async (dirList: SavedDirectory[]) => {
    setIsScanning(true);
    const allFound: DashboardPdfItem[] = [];
    const updatedDirs = [...dirList];

    for (let i = 0; i < updatedDirs.length; i++) {
      const dir = updatedDirs[i];
      if (isTauri()) {
        const results = await tauriScanDirectoryPdfs(dir.path);
        updatedDirs[i] = {
          ...dir,
          pdfCount: results.length,
        };

        results.forEach((res) => {
          allFound.push({
            id: res.file_path,
            fileName: res.file_name,
            filePath: res.file_path,
            fileSize: res.file_size,
            modifiedTimestamp: res.modified_timestamp,
            directoryPath: dir.path,
            numPages: res.num_pages ?? undefined,
          });
        });
      }
    }

    setDirectories(updatedDirs);
    saveSavedDirectories(updatedDirs);
    setPdfItems(allFound);
    setIsScanning(false);
  }, []);

  // Initial load: Add system default directories on first desktop launch if empty
  useEffect(() => {
    const initDirs = async () => {
      let saved = loadSavedDirectories();
      if (saved.length === 0 && isTauri()) {
        const defaults = await tauriGetDefaultDirectories();
        if (defaults && defaults.length > 0) {
          saved = defaults.map((dPath) => ({
            id: dPath,
            path: dPath,
            name: dPath.split('/').pop() || dPath.split('\\').pop() || 'Documents',
            addedAt: Date.now(),
          }));
          setDirectories(saved);
          saveSavedDirectories(saved);
        }
      }
      if (saved.length > 0) {
        scanAllDirectories(saved);
      }
    };
    initDirs();
  }, [scanAllDirectories]);

  // Handle Adding a new directory
  const handleAddDirectory = async () => {
    if (isTauri()) {
      const selectedPath = await tauriSelectDirectory();
      if (selectedPath) {
        // Avoid duplicate paths
        if (directories.some((d) => d.path === selectedPath)) {
          return;
        }
        const dirName =
          selectedPath.split('/').pop() || selectedPath.split('\\').pop() || 'Folder';
        const newDir: SavedDirectory = {
          id: selectedPath,
          path: selectedPath,
          name: dirName,
          addedAt: Date.now(),
        };
        const updated = [...directories, newDir];
        setDirectories(updated);
        saveSavedDirectories(updated);
        scanAllDirectories(updated);
      }
    } else {
      // Browser Web fallback directory name
      const customName = prompt('Enter a directory / collection label:');
      if (customName) {
        const newDir: SavedDirectory = {
          id: `dir_${Date.now()}`,
          path: customName,
          name: customName,
          addedAt: Date.now(),
          pdfCount: 0,
        };
        const updated = [...directories, newDir];
        setDirectories(updated);
        saveSavedDirectories(updated);
      }
    }
  };

  // Remove a saved directory
  const handleRemoveDirectory = (dirId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = directories.filter((d) => d.id !== dirId);
    setDirectories(updated);
    saveSavedDirectories(updated);
    if (activeFilter === dirId) {
      setActiveFilter('all');
    }
    scanAllDirectories(updated);
  };

  // Toggle favorite status
  const handleToggleFavorite = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleStorageFavorite(docId);
    setFavoriteIds(loadFavorites());
  };

  // Open PDF file handler
  const handleOpenItem = async (item: DashboardPdfItem) => {
    if (isTauri() && item.filePath) {
      const fileData = await tauriReadFile(item.filePath);
      if (fileData) {
        recordRecentDoc({
          fileName: fileData.fileName,
          filePath: fileData.filePath,
          fileSize: fileData.data.byteLength,
          modifiedTimestamp: Date.now(),
          lastReadPage: item.lastReadPage || 1,
        });
        setRecentDocs(loadRecentDocs());
        await onOpenPdf(fileData.data, fileData.fileName, fileData.filePath, item.lastReadPage);
        return;
      }
    }
  };

  // Browse standalone PDF from disk
  const handleBrowsePdf = async () => {
    if (isTauri()) {
      const fileData = await tauriOpenPdf();
      if (fileData) {
        recordRecentDoc({
          fileName: fileData.fileName,
          filePath: fileData.filePath,
          fileSize: fileData.data.byteLength,
          modifiedTimestamp: Date.now(),
        });
        setRecentDocs(loadRecentDocs());
        await onOpenPdf(fileData.data, fileData.fileName, fileData.filePath);
      }
    }
  };

  // Combine directory items with recent history items
  const combinedItems = useMemo(() => {
    const map = new Map<string, DashboardPdfItem>();

    // 1. Add all scanned directory items
    pdfItems.forEach((item) => {
      map.set(item.filePath, item);
    });

    // 2. Overlay recent docs
    recentDocs.forEach((rec) => {
      const existing = map.get(rec.filePath);
      if (existing) {
        map.set(rec.filePath, {
          ...existing,
          ...rec,
          modifiedTimestamp: existing.modifiedTimestamp,
        });
      } else {
        map.set(rec.filePath, rec);
      }
    });

    return Array.from(map.values()).map((item) => ({
      ...item,
      isFavorite: favoriteIds.includes(item.id || item.filePath),
    }));
  }, [pdfItems, recentDocs, favoriteIds]);

  // Filtered and sorted documents list
  const filteredItems = useMemo(() => {
    let list = combinedItems;

    // Filter by active category tab
    if (activeFilter === 'recent') {
      list = list.filter((i) => (i.lastOpenedAt || 0) > 0);
    } else if (activeFilter === 'favorites') {
      list = list.filter((i) => i.isFavorite);
    } else if (activeFilter !== 'all') {
      // Specific directory ID
      list = list.filter((i) => i.directoryPath === activeFilter);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.fileName.toLowerCase().includes(q) ||
          (i.filePath && i.filePath.toLowerCase().includes(q))
      );
    }

    // Sorting
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') {
        return a.fileName.localeCompare(b.fileName);
      }
      if (sortBy === 'size') {
        return (b.fileSize || 0) - (a.fileSize || 0);
      }
      // Default: recent / modified
      const timeA = a.lastOpenedAt || a.modifiedTimestamp || 0;
      const timeB = b.lastOpenedAt || b.modifiedTimestamp || 0;
      return timeB - timeA;
    });

    return list;
  }, [combinedItems, activeFilter, searchQuery, sortBy]);

  const totalPdfsCount = combinedItems.length;

  return (
    <div className="macos-window h-screen w-screen flex flex-col bg-[#1e1e24] text-[#f0f0f4] overflow-hidden select-none">
      {/* Top Studio App Header (macOS Tahoe Window Bar) */}
      <header
        data-tauri-drag-region
        onMouseDown={handleTitlebarMouseDown}
        className="macos-titlebar h-12 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-3.5 z-30 select-none app-drag-region text-xs cursor-default"
      >
        {/* Left window chrome */}
        <div className="flex items-center gap-2.5 justify-self-start" data-tauri-drag-region>
          {/* Spacer for native macOS traffic lights on desktop */}
          {isTauri() && <div className="macos-window-controls-spacer shrink-0" aria-hidden="true" data-tauri-drag-region />}
        </div>

        {/* Center Search Input (dead center in titlebar) */}
        <div className="flex items-center justify-center w-80 sm:w-96 md:w-[28rem] justify-self-center" data-tauri-drag-region>
          <div className="control-field macos-search-field w-full flex items-center gap-2 px-2.5 py-1 rounded-lg app-no-drag" data-tauri-drag-region="false">
            <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library documents..."
              className="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 border-0 outline-none w-full font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-zinc-500 hover:text-zinc-300 text-[10px] px-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Right Actions: Add Folder, Open File & Back to Reader Studio */}
        <div className="flex items-center gap-1.5 app-no-drag justify-self-end" data-tauri-drag-region="false">
          <button
            onClick={onToggleTheme}
            className="btn-icon"
            title={isDarkTheme ? 'Use light appearance' : 'Use dark appearance'}
            aria-label={isDarkTheme ? 'Use light appearance' : 'Use dark appearance'}
          >
            {isDarkTheme ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5 text-zinc-600" />}
          </button>

          <button
            onClick={handleAddDirectory}
            className="btn-secondary"
            title="Add directory folder to library"
          >
            <FolderPlus className="w-3.5 h-3.5 text-zinc-400" />
            <span>Add Folder</span>
          </button>

          <button
            onClick={handleBrowsePdf}
            className="btn-secondary"
            title="Browse single PDF file"
          >
            <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
            <span>Browse PDF</span>
          </button>
        </div>
      </header>

      {/* Main Studio Body: Sidebar Navigation + Document Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Library Navigator (Tahoe macOS Sidebar) */}
        <aside className="macos-sidebar w-60 flex flex-col p-3 gap-3 overflow-y-auto select-none">
          {/* Quick Categories */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400 px-2 py-1">
              Library Views
            </span>

            <button
              onClick={() => setActiveFilter('all')}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeFilter === 'all'
                  ? 'bg-blue-500/15 text-blue-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className={`w-3.5 h-3.5 ${activeFilter === 'all' ? 'text-blue-500' : 'text-zinc-400'}`} />
                <span>All Documents</span>
              </div>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-md ${activeFilter === 'all' ? 'bg-blue-500/20 text-blue-400 font-bold' : 'text-zinc-500'}`}>
                {totalPdfsCount}
              </span>
            </button>

            <button
              onClick={() => setActiveFilter('recent')}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeFilter === 'recent'
                  ? 'bg-blue-500/15 text-blue-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className={`w-3.5 h-3.5 ${activeFilter === 'recent' ? 'text-blue-500' : 'text-zinc-400'}`} />
                <span>Recent Reads</span>
              </div>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-md ${activeFilter === 'recent' ? 'bg-blue-500/20 text-blue-400 font-bold' : 'text-zinc-500'}`}>
                {recentDocs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveFilter('favorites')}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeFilter === 'favorites'
                  ? 'bg-blue-500/15 text-blue-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>Favorites</span>
              </div>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-md ${activeFilter === 'favorites' ? 'bg-blue-500/20 text-blue-400 font-bold' : 'text-zinc-500'}`}>
                {favoriteIds.length}
              </span>
            </button>
          </div>

          {/* Saved Directories List */}
          <div className="flex flex-col gap-1 pt-2 border-t border-[var(--border)]">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                Folders
              </span>
              <button
                onClick={() => scanAllDirectories(directories)}
                disabled={isScanning}
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="Rescan directories"
              >
                <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {directories.length === 0 ? (
              <div className="px-2 py-3 text-[11px] text-zinc-500 text-center">
                No folders added yet. Click &quot;Add Folder&quot; above.
              </div>
            ) : (
              directories.map((dir) => (
                <div
                  key={dir.id}
                  onClick={() => setActiveFilter(dir.id)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer group transition-all ${
                    activeFilter === dir.id
                      ? 'bg-blue-500/15 text-blue-400 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Folder className={`w-3.5 h-3.5 shrink-0 ${activeFilter === dir.id ? 'text-blue-500' : 'text-zinc-400'}`} />
                    <span className="truncate font-medium">{dir.name}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[10px] text-zinc-500 group-hover:text-zinc-300">
                      {dir.pdfCount ?? 0}
                    </span>
                    <button
                      onClick={(e) => handleRemoveDirectory(dir.id, e)}
                      className="p-1 rounded-md text-zinc-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove folder from library"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main Document Library Content */}
        <main className="macos-content flex-1 p-6 overflow-y-auto flex flex-col gap-5">
          {/* Controls Bar: Title, Count, Layout, Sorting */}
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-100 tracking-tight capitalize">
                {activeFilter === 'all'
                  ? 'All Documents'
                  : activeFilter === 'recent'
                  ? 'Recently Read Documents'
                  : activeFilter === 'favorites'
                  ? 'Favorite Documents'
                  : directories.find((d) => d.id === activeFilter)?.name || 'Directory Documents'}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-[var(--secondary)] text-[10.5px] font-mono text-zinc-400 border border-[var(--border)]">
                {filteredItems.length} {filteredItems.length === 1 ? 'file' : 'files'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Tahoe Styled Sort Selector */}
              <div ref={sortMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsSortOpen((open) => !open)}
                  className={`flex items-center gap-2 min-w-40 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    isSortOpen
                      ? 'bg-[var(--card)] border-[var(--ring)] text-white shadow-md'
                      : 'bg-[var(--secondary)] border-[var(--border)] text-zinc-300 hover:bg-[var(--card)]'
                  }`}
                  aria-haspopup="menu"
                  aria-expanded={isSortOpen}
                >
                  <ArrowUpDown className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                  <span className="flex-1 text-left">
                    {SORT_OPTIONS.find((option) => option.value === sortBy)?.label}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 text-zinc-400 transition-transform ${isSortOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isSortOpen && (
                  <div
                    role="menu"
                    className="absolute top-full right-0 z-50 mt-1.5 w-48 p-1.5 rounded-xl bg-[var(--popover)] border border-[var(--border)] shadow-2xl backdrop-blur-xl animate-slide-down"
                  >
                    <div className="px-2.5 pt-1 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                      Sort documents
                    </div>
                    {SORT_OPTIONS.map((option) => {
                      const OptionIcon = option.icon;
                      const isSelected = sortBy === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={isSelected}
                          onClick={() => {
                            setSortBy(option.value);
                            setIsSortOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 hover:text-zinc-100'
                          }`}
                        >
                          <OptionIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="flex-1 text-left font-medium">{option.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Empty State */}
          {filteredItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[var(--secondary)] border border-[var(--border)] flex items-center justify-center text-zinc-400 shadow-sm">
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1 max-w-sm">
                <h3 className="text-sm font-semibold text-zinc-200">No PDF documents found</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {directories.length === 0
                    ? 'Add folders to your saved directories to automatically scan and browse your PDF library.'
                    : 'No documents match your current filter or search criteria.'}
                </p>
              </div>
              <button
                onClick={handleAddDirectory}
                className="btn-primary py-2 px-4"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Add Folder to Library</span>
              </button>
            </div>
          ) : (
            <div className="library-document-list pb-12" aria-label="PDF library documents">
              {filteredItems.map((item) => (
                <div
                  key={item.filePath || item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenItem(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleOpenItem(item);
                    }
                  }}
                  className="library-document-list-item group"
                >
                  <div className="library-document-list-icon shrink-0" aria-hidden="true">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate text-[13px] font-medium text-zinc-200 group-hover:text-white" title={item.fileName}>
                        {item.fileName}
                      </span>
                      {item.annotationCount !== undefined && item.annotationCount > 0 && (
                        <span className="macos-annotation-count shrink-0">
                          {item.annotationCount} note{item.annotationCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-x-2 gap-y-0.5 overflow-hidden text-[11px] text-zinc-500">
                      <span className="truncate max-w-[22rem]">{item.directoryPath || item.filePath || 'Local document'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0 tabular-nums">{item.fileSize ? `${(item.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}</span>
                      {item.numPages !== undefined && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="shrink-0 tabular-nums">
                            {item.numPages} {item.numPages === 1 ? 'page' : 'pages'}
                          </span>
                        </>
                      )}
                      {item.lastReadPage && <span className="shrink-0">Last read · Page {item.lastReadPage}</span>}
                    </div>
                  </div>
                  <button
                    onClick={(event) => handleToggleFavorite(item.id || item.filePath, event)}
                    className={`library-document-list-favorite ${item.isFavorite ? 'is-favorite' : ''}`}
                    title={item.isFavorite ? 'Remove Favorite' : 'Mark as Favorite'}
                    aria-label={item.isFavorite ? `Remove ${item.fileName} from favorites` : `Add ${item.fileName} to favorites`}
                  >
                    <Star className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  <ArrowRight className="library-document-list-arrow w-4 h-4 shrink-0" aria-hidden="true" />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Floating Circular Resume Reading Button (Bottom Right) */}
      {hasActiveDoc && (
        <button
          onClick={onSwitchToReader}
          className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full flex items-center justify-center text-white bg-gradient-to-b from-[#3b99ff] to-[#0066eb] shadow-xl hover:scale-108 active:scale-95 transition-all cursor-pointer border border-white/25 group"
          title={`Resume Reading: ${activeDocName}`}
          aria-label={`Resume Reading: ${activeDocName}`}
        >
          <BookOpen className="w-5 h-5 transition-transform group-hover:scale-110" />
        </button>
      )}
    </div>
  );
};
