import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FolderPlus,
  FolderOpen,
  FileText,
  Search,
  Star,
  Clock,
  LayoutGrid,
  List,
  RefreshCw,
  Trash2,
  BookOpen,
  Sparkles,
  ArrowRight,
  HardDrive,
  CheckCircle2,
  Folder,
  Layers,
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
} from '../utils/tauriBridge';
import {
  loadSavedDirectories,
  saveSavedDirectories,
  loadRecentDocs,
  recordRecentDoc,
  loadFavorites,
  toggleFavorite as toggleStorageFavorite,
} from '../utils/storage';
import { pdfjsLib } from '../utils/pdfWorker';

interface DashboardProps {
  onOpenPdf: (data: Uint8Array, fileName: string, filePath?: string, initialPageNumber?: number) => void;
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

const coverCache = new Map<string, string>();

const PdfCoverThumbnail: React.FC<{ item: DashboardPdfItem }> = ({ item }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cacheKey = `${item.filePath}:${item.modifiedTimestamp}`;
  const [isVisible, setIsVisible] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(() => coverCache.get(cacheKey) || null);
  const [isLoadingCover, setIsLoadingCover] = useState(!coverCache.has(cacheKey));

  useEffect(() => {
    const node = containerRef.current;
    if (!node || coverUrl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '320px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [coverUrl]);

  useEffect(() => {
    if (!isVisible || coverUrl || !item.filePath || !isTauri()) {
      if (isVisible && !isTauri()) setIsLoadingCover(false);
      return;
    }

    let isCancelled = false;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;

    const renderCover = async () => {
      try {
        const cached = coverCache.get(cacheKey);
        if (cached) {
          setCoverUrl(cached);
          return;
        }

        const fileData = await tauriReadFile(item.filePath);
        if (!fileData || isCancelled) return;

        loadingTask = pdfjsLib.getDocument({ data: fileData.data });
        const doc = await loadingTask.promise;
        const page = await doc.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = 440 / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: false });

        if (!context || isCancelled) {
          await doc.destroy();
          return;
        }

        canvas.width = Math.ceil(viewport.width * outputScale);
        canvas.height = Math.ceil(viewport.height * outputScale);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        }).promise;

        const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
        coverCache.set(cacheKey, dataUrl);
        if (!isCancelled) setCoverUrl(dataUrl);
        await doc.destroy();
      } catch {
        // A missing or protected file simply uses the styled PDF fallback.
      } finally {
        if (!isCancelled) setIsLoadingCover(false);
      }
    };

    renderCover();
    return () => {
      isCancelled = true;
      loadingTask?.destroy();
    };
  }, [cacheKey, coverUrl, isVisible, item.filePath]);

  return (
    <div
      ref={containerRef}
      className="library-pdf-cover relative w-full aspect-[3/4] overflow-hidden bg-[#1a1a20] border-b border-[#32323e] flex items-center justify-center"
    >
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={`First page of ${item.fileName}`}
          className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.015]"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[linear-gradient(145deg,var(--secondary),var(--card))]">
          <div className="w-14 h-18 bg-white border border-black/10 shadow-md flex items-center justify-center text-[#2e97ef]">
            <FileText className="w-7 h-7" />
          </div>
          <span className="max-w-[75%] truncate text-[10px] font-medium text-zinc-400">
            {isLoadingCover ? 'Loading cover…' : 'PDF document'}
          </span>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />
      <span className="absolute bottom-2.5 left-3 px-2 py-0.5 rounded-full bg-black/55 text-[9px] font-semibold tracking-[0.12em] text-white backdrop-blur-sm">
        PDF
      </span>
    </div>
  );
};

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
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [isScanning, setIsScanning] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

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
        onOpenPdf(fileData.data, fileData.fileName, fileData.filePath, item.lastReadPage);
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
        onOpenPdf(fileData.data, fileData.fileName, fileData.filePath);
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
        map.set(rec.filePath, { ...existing, ...rec });
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
    <div className="h-screen w-screen flex flex-col bg-[#1e1e24] text-[#f0f0f4] overflow-hidden select-none">
      {/* Top Studio App Header */}
      <header className="h-11 bg-[#24242b] border-b border-[#363642] flex items-center justify-between px-3 z-30 select-none app-drag-region text-xs">
        {/* Left branding */}
        <div className="flex items-center gap-2 app-no-drag">
          <div className="w-16 hidden sm:block" />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1d1d23] border border-[#343440] text-zinc-200 font-semibold tracking-tight">
            <Layers className="w-4 h-4 text-zinc-300" />
            <span>PDFuck Studio</span>
          </div>
        </div>

        {/* Center Search Input */}
        <div className="flex items-center gap-2 app-no-drag w-full max-w-md">
          <div className="control-field w-full flex items-center gap-1.5 px-2.5 py-1 bg-[#1d1d23] rounded-md border border-[#343440]">
            <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library documents..."
              className="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-full font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-zinc-500 hover:text-zinc-300 text-[10px]"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Right Actions: Add Folder, Open File & Back to Reader Studio */}
        <div className="flex items-center gap-1.5 app-no-drag">
          <button
            onClick={onToggleTheme}
            className="btn-icon"
            title={isDarkTheme ? 'Use light appearance' : 'Use dark appearance'}
            aria-label={isDarkTheme ? 'Use light appearance' : 'Use dark appearance'}
          >
            {isDarkTheme ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
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

          {hasActiveDoc && (
            <button
              onClick={onSwitchToReader}
              className="btn-primary ml-1"
              title={`Return to active document (${activeDocName})`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Resume Reading</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Studio Body: Sidebar Navigation + Document Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Library Navigator */}
        <aside className="w-60 bg-[#222228] border-r border-[#343440] flex flex-col p-3 gap-3 overflow-y-auto select-none">
          {/* Quick Categories */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 px-2 py-1">
              Library Views
            </span>

            <button
              onClick={() => setActiveFilter('all')}
              className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeFilter === 'all'
                  ? 'bg-[#32323e] text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#2a2a34]'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                <span>All Documents</span>
              </div>
              <span className="font-mono text-[10px] text-zinc-500">{totalPdfsCount}</span>
            </button>

            <button
              onClick={() => setActiveFilter('recent')}
              className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeFilter === 'recent'
                  ? 'bg-[#32323e] text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#2a2a34]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Recent Reads</span>
              </div>
              <span className="font-mono text-[10px] text-zinc-500">
                {recentDocs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveFilter('favorites')}
              className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeFilter === 'favorites'
                  ? 'bg-[#32323e] text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#2a2a34]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                <span>Favorites</span>
              </div>
              <span className="font-mono text-[10px] text-zinc-500">
                {favoriteIds.length}
              </span>
            </button>
          </div>

          {/* Saved Directories List */}
          <div className="flex flex-col gap-1 pt-2 border-t border-[#30303a]">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Saved Directories
              </span>
              <button
                onClick={() => scanAllDirectories(directories)}
                disabled={isScanning}
                className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded"
                title="Rescan directories"
              >
                <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {directories.length === 0 ? (
              <div className="px-2 py-3 text-[11px] text-zinc-500 text-center">
                No directories added yet. Click &quot;Add Folder&quot; above.
              </div>
            ) : (
              directories.map((dir) => (
                <div
                  key={dir.id}
                  onClick={() => setActiveFilter(dir.id)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer group transition-all ${
                    activeFilter === dir.id
                      ? 'bg-[#32323e] text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#2a2a34]'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Folder className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate font-medium">{dir.name}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[10px] text-zinc-500 group-hover:text-zinc-300">
                      {dir.pdfCount ?? 0}
                    </span>
                    <button
                      onClick={(e) => handleRemoveDirectory(dir.id, e)}
                      className="p-1 rounded text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
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

        {/* Main Document Grid / List Content */}
        <main className="flex-1 bg-[#1c1c22] p-6 overflow-y-auto flex flex-col gap-5">
          {/* Controls Bar: Title, Count, Layout, Sorting */}
          <div className="flex items-center justify-between border-b border-[#343440] pb-3">
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
              <span className="px-2 py-0.5 rounded-full bg-[#2a2a34] text-[10px] font-mono text-zinc-400 border border-[#383846]">
                {filteredItems.length} {filteredItems.length === 1 ? 'file' : 'files'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Styled Sort Selector */}
              <div ref={sortMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsSortOpen((open) => !open)}
                  className={`flex items-center gap-2 min-w-42 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                    isSortOpen
                      ? 'bg-[#34343f] border-[#484856] text-white shadow-md'
                      : 'bg-[#24242b] border-[#343440] text-zinc-300 hover:bg-[#2a2a34]'
                  }`}
                  aria-haspopup="menu"
                  aria-expanded={isSortOpen}
                >
                  <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 text-left">
                    {SORT_OPTIONS.find((option) => option.value === sortBy)?.label}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform ${isSortOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isSortOpen && (
                  <div
                    role="menu"
                    className="absolute top-full right-0 z-50 mt-2 w-48 p-1.5 rounded-lg bg-[#26262d] border border-[#3a3a46] shadow-2xl backdrop-blur-xl animate-slide-down"
                  >
                    <div className="px-2.5 pt-1 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
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
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs transition-colors ${
                            isSelected
                              ? 'bg-[#34343f] text-white'
                              : 'text-zinc-300 hover:bg-[#2a2a34] hover:text-zinc-100'
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

              {/* View Layout Toggle */}
              <div className="flex items-center bg-[#24242b] border border-[#343440] p-0.5 rounded-md">
                <button
                  onClick={() => setViewLayout('grid')}
                  className={`p-1 rounded transition-all ${
                    viewLayout === 'grid'
                      ? 'bg-[#34343f] text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewLayout('list')}
                  className={`p-1 rounded transition-all ${
                    viewLayout === 'list'
                      ? 'bg-[#34343f] text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Table List View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Empty State */}
          {filteredItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#24242b] border border-[#383846] flex items-center justify-center text-zinc-400">
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
          ) : viewLayout === 'grid' ? (
            /* GRID VIEW */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 pb-12">
              {filteredItems.map((item) => (
                <div
                  key={item.filePath || item.id}
                  onClick={() => handleOpenItem(item)}
                  className="library-pdf-card rounded-xl bg-[#24242b] hover:bg-[#2a2a34] border border-[#383846] hover:border-zinc-500 overflow-hidden flex flex-col cursor-pointer group transition-all duration-150 shadow-md hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.99]"
                >
                  {/* Real first-page cover, rendered lazily from the PDF. */}
                  <div className="relative">
                    <PdfCoverThumbnail item={item} />

                    {/* Star button */}
                    <button
                      onClick={(e) => handleToggleFavorite(item.id || item.filePath, e)}
                      className={`absolute top-2.5 right-2.5 p-1.5 rounded-full backdrop-blur-md transition-all ${
                        item.isFavorite
                          ? 'text-amber-400 bg-black/55'
                          : 'text-white hover:text-amber-400 opacity-0 group-hover:opacity-100 bg-black/35'
                      }`}
                      title={item.isFavorite ? 'Remove Favorite' : 'Mark as Favorite'}
                    >
                      <Star className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-amber-400' : ''}`} />
                    </button>

                    {item.annotationCount !== undefined && item.annotationCount > 0 && (
                      <span className="absolute bottom-2.5 right-3 px-2 py-0.5 rounded-full bg-amber-500/90 text-white text-[9px] font-medium shadow-md">
                        {item.annotationCount} note{item.annotationCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>

                  {/* Document Title & Meta */}
                  <div className="flex flex-col gap-1.5 p-3.5">
                    <span
                      className="font-semibold text-[13px] text-zinc-200 group-hover:text-white truncate"
                      title={item.fileName}
                    >
                      {item.fileName}
                    </span>

                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                      <span>
                        {item.fileSize ? `${(item.fileSize / 1024 / 1024).toFixed(1)} MB` : 'N/A'}
                      </span>
                      {item.lastReadPage && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[#2a2a34] text-zinc-300">
                          Page {item.lastReadPage}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* TABLE LIST VIEW */
            <div className="rounded-xl border border-[#383846] bg-[#24242b] overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#343440] bg-[#1d1d23] text-zinc-400 text-[11px] font-medium">
                    <th className="py-2.5 px-3 w-8"></th>
                    <th className="py-2.5 px-3">Document Name</th>
                    <th className="py-2.5 px-3 hidden md:table-cell">Path / Directory</th>
                    <th className="py-2.5 px-3 w-24">Size</th>
                    <th className="py-2.5 px-3 w-32 hidden sm:table-cell">Last Modified</th>
                    <th className="py-2.5 px-3 w-20 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#32323e]">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.filePath || item.id}
                      onClick={() => handleOpenItem(item)}
                      className="hover:bg-[#2a2a34] cursor-pointer group transition-colors"
                    >
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={(e) => handleToggleFavorite(item.id || item.filePath, e)}
                          className="text-zinc-500 hover:text-amber-400"
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              item.isFavorite ? 'text-amber-400 fill-amber-400' : ''
                            }`}
                          />
                        </button>
                      </td>
                      <td className="py-2 px-3 font-medium text-zinc-200 group-hover:text-white truncate max-w-[200px]">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="truncate">{item.fileName}</span>
                          {item.annotationCount !== undefined && item.annotationCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-mono shrink-0">
                              ✏️ {item.annotationCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-zinc-400 font-mono text-[10.5px] truncate max-w-[250px] hidden md:table-cell">
                        {item.filePath}
                      </td>
                      <td className="py-2 px-3 text-zinc-400 font-mono text-[11px]">
                        {item.fileSize ? `${(item.fileSize / 1024 / 1024).toFixed(2)} MB` : '-'}
                      </td>
                      <td className="py-2 px-3 text-zinc-500 text-[11px] hidden sm:table-cell">
                        {item.modifiedTimestamp
                          ? new Date(item.modifiedTimestamp).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-zinc-400 group-hover:text-white inline-flex items-center gap-1 font-medium text-[11px]">
                          Open <ArrowRight className="w-3 h-3" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
