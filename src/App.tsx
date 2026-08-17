import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { PDFViewer } from './components/PDFViewer';
import { ColorThemeModal } from './components/ColorThemeModal';
import { StampPickerModal } from './components/StampPickerModal';
import { SearchBar } from './components/SearchBar';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { ExportModal } from './components/ExportModal';

import { usePDFDocument } from './hooks/usePDFDocument';
import { useAnnotations } from './hooks/useAnnotations';
import { useColorTheme } from './hooks/useColorTheme';
import { useKeyboard } from './hooks/useKeyboard';
import { createSamplePDF } from './utils/samplePdf';
import { loadViewMode, saveViewMode } from './utils/storage';
import { isTauri, tauriOpenPdf, tauriOpenImage } from './utils/tauriBridge';
import type { ToolType, ViewMode } from './utils/types';

export function App() {
  // View & UI State
  const [zoom, setZoom] = useState<number>(1.15);
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadViewMode());
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState<boolean>(false);
  const [isStampPickerOpen, setIsStampPickerOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Active Tool & Style State
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [selectedColor, setSelectedColor] = useState<string>('#ffe600');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [opacity, setOpacity] = useState<number>(0.45);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  // Hidden File Inputs for Browser fallback
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Active Cursor coordinates over PDF pages for precise cursor pasting
  const cursorPosRef = useRef<{ pageNumber: number; x: number; y: number } | null>(null);

  // Custom Hooks
  const {
    pdfDoc,
    rawPdfBytes,
    docInfo,
    outline,
    currentPage,
    docKey,
    loadPdf,
    changePage,
    searchResults,
    currentMatchIndex,
    isSearching,
    searchInDocument,
    nextSearchResult,
    prevSearchResult,
  } = usePDFDocument();

  const {
    annotations,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    clearAllAnnotationsForPage,
    undo,
    redo,
    canUndo,
    canRedo,
    addAttachedImage,
  } = useAnnotations(docKey);

  const {
    settings: themeSettings,
    setTheme,
    toggleInvert,
    updateSetting,
    resetFilters,
    getPageFilterClass,
    getCustomFilterStyle,
  } = useColorTheme();

  const isDarkTheme = themeSettings.theme !== 'default' && themeSettings.theme !== 'sepia';

  // Load sample document on initial start if empty
  useEffect(() => {
    let mounted = true;
    createSamplePDF().then((sampleBytes) => {
      if (mounted && !pdfDoc) {
        loadPdf(sampleBytes, 'High_Performance_Systems_Whitepaper.pdf');
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Handle View Mode Change
  const handleChangeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    saveViewMode(mode);
  };

  // Open PDF File (Tauri or Browser input)
  const handleOpenPdf = async () => {
    if (isTauri()) {
      const result = await tauriOpenPdf();
      if (result) {
        loadPdf(result.data, result.fileName);
        return;
      }
    }

    // Web fallback
    pdfInputRef.current?.click();
  };

  const handlePdfInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          loadPdf(new Uint8Array(reader.result), file.name);
        }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = '';
    }
  };

  // Attach Image from Disk (Tauri or Web input)
  const handleOpenImage = async () => {
    const targetPage = cursorPosRef.current ? cursorPosRef.current.pageNumber : currentPage;
    const posX = cursorPosRef.current ? cursorPosRef.current.x : 0.5;
    const posY = cursorPosRef.current ? cursorPosRef.current.y : 0.45;

    if (isTauri()) {
      const result = await tauriOpenImage();
      if (result && result.dataUrl) {
        addAttachedImage(targetPage, result.dataUrl, 1.33, result.fileName, {
          x: posX,
          y: posY,
          attachedInInvertedMode: isDarkTheme,
          invertInLightMode: isDarkTheme,
        });
        setActiveTool('select');
        return;
      }
    }

    // Web fallback
    imageInputRef.current?.click();
  };

  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const targetPage = cursorPosRef.current ? cursorPosRef.current.pageNumber : currentPage;
      const posX = cursorPosRef.current ? cursorPosRef.current.x : 0.5;
      const posY = cursorPosRef.current ? cursorPosRef.current.y : 0.45;

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          addAttachedImage(targetPage, reader.result, 1.33, file.name, {
            x: posX,
            y: posY,
            attachedInInvertedMode: isDarkTheme,
            invertInLightMode: isDarkTheme,
          });
          setActiveTool('select');
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  // Image file drop on a specific page
  const handleImageDropOnPage = (pageNumber: number, file: File) => {
    const posX = cursorPosRef.current?.pageNumber === pageNumber ? cursorPosRef.current.x : 0.5;
    const posY = cursorPosRef.current?.pageNumber === pageNumber ? cursorPosRef.current.y : 0.45;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        addAttachedImage(pageNumber, reader.result, 1.33, file.name, {
          x: posX,
          y: posY,
          attachedInInvertedMode: isDarkTheme,
          invertInLightMode: isDarkTheme,
        });
        setActiveTool('select');
      }
    };
    reader.readAsDataURL(file);
  };

  // Load sample document on click
  const handleLoadSample = async () => {
    const bytes = await createSamplePDF();
    loadPdf(bytes, 'High_Performance_Systems_Whitepaper.pdf');
  };

  // Handle Clipboard Paste (Cmd+V) of images directly at the mouse cursor position!
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.items) {
        for (const item of Array.from(e.clipboardData.items)) {
          if (item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            if (blob) {
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === 'string') {
                  const targetPage = cursorPosRef.current
                    ? cursorPosRef.current.pageNumber
                    : currentPage;
                  const posX = cursorPosRef.current ? cursorPosRef.current.x : 0.5;
                  const posY = cursorPosRef.current ? cursorPosRef.current.y : 0.45;

                  addAttachedImage(targetPage, reader.result, 1.33, 'Pasted Image', {
                    x: posX,
                    y: posY,
                    attachedInInvertedMode: isDarkTheme,
                    invertInLightMode: isDarkTheme,
                  });
                  setActiveTool('select');
                }
              };
              reader.readAsDataURL(blob);
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [currentPage, isDarkTheme, addAttachedImage]);

  // Global Keyboard Shortcuts
  useKeyboard({
    onOpenPdf: handleOpenPdf,
    onSavePdf: () => setIsExportModalOpen(true),
    onSaveJson: () => setIsExportModalOpen(true),
    onToggleInvert: toggleInvert,
    onToggleSearch: () => setIsSearchOpen((prev) => !prev),
    onSelectTool: (t) => setActiveTool(t),
    onUndo: undo,
    onRedo: redo,
    onZoomIn: () => setZoom((z) => Math.min(3.0, z + 0.15)),
    onZoomOut: () => setZoom((z) => Math.max(0.4, z - 0.15)),
    onResetZoom: () => setZoom(1.15),
    onNextPage: () => changePage(currentPage + 1),
    onPrevPage: () => changePage(currentPage - 1),
    onToggleZen: () => setIsZenMode((prev) => !prev),
    onToggleShortcuts: () => setIsShortcutsModalOpen((prev) => !prev),
  });

  return (
    <div className="h-screen w-screen flex flex-col bg-[#09090b] text-[#f4f4f5] overflow-hidden select-none">
      {/* Hidden File Inputs for Browser Fallback */}
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handlePdfInputChange}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageInputChange}
      />

      {/* Top Header & Titlebar */}
      <Header
        docInfo={docInfo}
        currentPage={currentPage}
        numPages={pdfDoc?.numPages || 0}
        zoom={zoom}
        viewMode={viewMode}
        theme={themeSettings.theme}
        isZenMode={isZenMode}
        isSidebarOpen={isSidebarOpen}
        isSearchOpen={isSearchOpen}
        onOpenPdf={handleOpenPdf}
        onLoadSample={handleLoadSample}
        onExportClick={() => setIsExportModalOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
        onToggleInvert={toggleInvert}
        onOpenThemeModal={() => setIsThemeModalOpen(true)}
        onToggleZen={() => setIsZenMode((prev) => !prev)}
        onToggleShortcuts={() => setIsShortcutsModalOpen(true)}
        onChangeViewMode={handleChangeViewMode}
        onChangeZoom={(newZoom) => setZoom(newZoom)}
        onPageChange={(p) => changePage(p)}
      />

      {/* Main Reading & Sidebar Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Navigation Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen && !isZenMode}
          pdfDoc={pdfDoc}
          docInfo={docInfo}
          outline={outline}
          currentPage={currentPage}
          numPages={pdfDoc?.numPages || 0}
          annotations={annotations}
          onClose={() => setIsSidebarOpen(false)}
          onPageSelect={(p) => changePage(p)}
          onDeleteAnnotation={(id) => deleteAnnotation(id)}
        />

        {/* Primary PDF Canvas Viewport */}
        <PDFViewer
          pdfDoc={pdfDoc}
          rawPdfBytes={rawPdfBytes}
          currentPage={currentPage}
          numPages={pdfDoc?.numPages || 0}
          zoom={zoom}
          viewMode={viewMode}
          currentTheme={themeSettings.theme}
          filterClass={getPageFilterClass()}
          customFilterStyle={getCustomFilterStyle()}
          activeTool={activeTool}
          selectedColor={selectedColor}
          strokeWidth={strokeWidth}
          opacity={opacity}
          annotations={annotations}
          selectedAnnotationId={selectedAnnotationId}
          onPageChange={(p) => changePage(p)}
          onSelectAnnotation={(id) => setSelectedAnnotationId(id)}
          onAddAnnotation={(ann) => addAnnotation(ann)}
          onUpdateAnnotation={(id, up) => updateAnnotation(id, up)}
          onDeleteAnnotation={(id) => deleteAnnotation(id)}
          onImageDrop={handleImageDropOnPage}
          onCursorMove={(page, x, y) => {
            cursorPosRef.current = { pageNumber: page, x, y };
          }}
          onPdfFileDrop={(file) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (reader.result instanceof ArrayBuffer) {
                loadPdf(new Uint8Array(reader.result), file.name);
              }
            };
            reader.readAsArrayBuffer(file);
          }}
          onOpenPdfClick={handleOpenPdf}
          onLoadSampleClick={handleLoadSample}
        />
      </div>

      {/* Floating Tool Dock */}
      {pdfDoc && !isZenMode && (
        <Toolbar
          activeTool={activeTool}
          selectedColor={selectedColor}
          strokeWidth={strokeWidth}
          opacity={opacity}
          canUndo={canUndo}
          canRedo={canRedo}
          onSelectTool={(t) => setActiveTool(t)}
          onSelectColor={(c) => setSelectedColor(c)}
          onChangeStrokeWidth={(w) => setStrokeWidth(w)}
          onChangeOpacity={(op) => setOpacity(op)}
          onAttachImageClick={handleOpenImage}
          onOpenStampPicker={() => setIsStampPickerOpen(true)}
          onUndo={undo}
          onRedo={redo}
          onClearPageAnnotations={() => clearAllAnnotationsForPage(currentPage)}
        />
      )}

      {/* Full-Text Search Bar */}
      <SearchBar
        isOpen={isSearchOpen}
        isSearching={isSearching}
        searchResults={searchResults}
        currentMatchIndex={currentMatchIndex}
        onSearch={(q) => searchInDocument(q)}
        onNext={nextSearchResult}
        onPrev={prevSearchResult}
        onClose={() => setIsSearchOpen(false)}
      />

      {/* Reading Theme & Color Invert Settings Modal */}
      <ColorThemeModal
        isOpen={isThemeModalOpen}
        settings={themeSettings}
        onClose={() => setIsThemeModalOpen(false)}
        onSelectTheme={(t) => setTheme(t)}
        onUpdateSetting={updateSetting}
        onResetFilters={resetFilters}
      />

      {/* Stamps & Stickers Picker Modal */}
      <StampPickerModal
        isOpen={isStampPickerOpen}
        onClose={() => setIsStampPickerOpen(false)}
        onSelectStamp={(dataUrl, name) => {
          const targetPage = cursorPosRef.current ? cursorPosRef.current.pageNumber : currentPage;
          const posX = cursorPosRef.current ? cursorPosRef.current.x : 0.5;
          const posY = cursorPosRef.current ? cursorPosRef.current.y : 0.45;

          addAttachedImage(targetPage, dataUrl, 2.5, name, {
            x: posX,
            y: posY,
            attachedInInvertedMode: isDarkTheme,
            invertInLightMode: isDarkTheme,
          });
          setActiveTool('select');
        }}
        onAttachCustomImage={handleOpenImage}
      />

      {/* Keyboard Shortcuts Reference Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* PDF Export & Save Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        rawPdfBytes={rawPdfBytes}
        annotations={annotations}
        fileName={docInfo?.fileName || 'document.pdf'}
        currentPage={currentPage}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}

export default App;
