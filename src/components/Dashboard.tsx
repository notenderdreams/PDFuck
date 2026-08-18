import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

interface DashboardProps {
  onOpenPdf: (data: Uint8Array, fileName: string, filePath?: string) => void;
  onSwitchToReader: () => void;
  hasActiveDoc: boolean;
  activeDocName?: string;
}

type FilterTab = 'all' | 'recent' | 'favorites' | string; // string for specific directory ID

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenPdf,
  onSwitchToReader,
  hasActiveDoc,
  activeDocName,
}) => {
  const [directories, setDirectories] = useState<SavedDirectory[]>(() => loadSavedDirectories());
  const [pdfItems, setPdfItems] = useState<DashboardPdfItem[]>([]);
  const [recentDocs, setRecentDocs] = useState<DashboardPdfItem[]>(() => loadRecentDocs());
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadFavorites());
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'size'>('recent');
  const [isScanning, setIsScanning] = useState(false);

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
        });
        setRecentDocs(loadRecentDocs());
        onOpenPdf(fileData.data, fileData.fileName, fileData.filePath);
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
          <div className="w-full flex items-center gap-1.5 px-2.5 py-1 bg-[#1d1d23] rounded-md border border-[#343440]">
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
              {/* Sort Selector */}
              <div className="flex items-center gap-1 text-xs text-zinc-400 bg-[#24242b] border border-[#343440] px-2 py-1 rounded-md">
                <span className="text-[10px] text-zinc-500">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'recent' | 'name' | 'size')}
                  className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer"
                >
                  <option value="recent">Recently Opened</option>
                  <option value="name">File Name</option>
                  <option value="size">File Size</option>
                </select>
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
                  className="p-3.5 rounded-xl bg-[#24242b] hover:bg-[#2a2a34] border border-[#383846] hover:border-zinc-500 flex flex-col justify-between gap-3 cursor-pointer group transition-all duration-150 shadow-md hover:shadow-xl active:scale-[0.99]"
                >
                  {/* Card Thumbnail / Banner */}
                  <div className="w-full aspect-[4/3] rounded-lg bg-[#1a1a20] border border-[#32323e] flex flex-col items-center justify-center relative overflow-hidden group-hover:border-zinc-500/50 transition-colors">
                    <FileText className="w-10 h-10 text-zinc-400 group-hover:text-zinc-200 transition-colors" />

                    {/* Star button */}
                    <button
                      onClick={(e) => handleToggleFavorite(item.id || item.filePath, e)}
                      className={`absolute top-2 right-2 p-1 rounded-md transition-all ${
                        item.isFavorite
                          ? 'text-amber-400 bg-black/40'
                          : 'text-zinc-500 hover:text-amber-400 opacity-0 group-hover:opacity-100 bg-black/20'
                      }`}
                      title={item.isFavorite ? 'Remove Favorite' : 'Mark as Favorite'}
                    >
                      <Star className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-amber-400' : ''}`} />
                    </button>

                    {/* Badge */}
                    <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/50 text-[9px] font-mono text-zinc-400">
                      PDF
                    </span>
                  </div>

                  {/* Document Title & Meta */}
                  <div className="flex flex-col gap-1">
                    <span
                      className="font-medium text-xs text-zinc-200 group-hover:text-white truncate"
                      title={item.fileName}
                    >
                      {item.fileName}
                    </span>

                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                      <span>
                        {item.fileSize ? `${(item.fileSize / 1024 / 1024).toFixed(1)} MB` : 'N/A'}
                      </span>
                      {item.lastReadPage && (
                        <span className="text-zinc-300">p.{item.lastReadPage}</span>
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
