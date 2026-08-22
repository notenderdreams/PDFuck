import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { PDFViewer } from './components/PDFViewer';
import { Dashboard } from './components/Dashboard';
import { ColorThemeModal } from './components/ColorThemeModal';
import { StampPickerModal } from './components/StampPickerModal';
import { SearchBar } from './components/SearchBar';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { ExportModal } from './components/ExportModal';
import { Check, Info, Sidebar as SidebarIcon } from 'lucide-react';

import { usePDFDocument } from './hooks/usePDFDocument';
import { useAnnotations } from './hooks/useAnnotations';
import { useSnippets } from './hooks/useSnippets';
import { useColorTheme } from './hooks/useColorTheme';
import { usesInvertedColorSpace } from './utils/readingTheme';
import { useKeyboard } from './hooks/useKeyboard';
import { createSamplePDF } from './utils/samplePdf';
import { loadViewMode, saveViewMode, recordRecentDoc } from './utils/storage';
import { isTauri, tauriOpenPdf, tauriOpenImage } from './utils/tauriBridge';
import {
  extractPageText,
  copyTextToClipboard,
  copyPageImageToClipboard,
  downloadPageAsJpg,
} from './utils/pageExtractor';
import { getImageDimensions } from './utils/imageUtils';
import {
  cropCanvasRegion,
  copyStitchedSnippetsToClipboard,
  downloadStitchedSnippets,
} from './utils/snippetExtractor';
import type { AppScreen, ToolType, ViewMode, StitchOptions } from './utils/types';
import type { SidebarTabType } from './components/Sidebar';

export function App() {
  // Screen Routing: 'dashboard' (Library view) | 'reader' (PDF reader & annotation studio)
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('dashboard');

  // View & UI State
  const [zoom, setZoom] = useState<number>(1.15);
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadViewMode());
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTabType>('thumbnails');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState<boolean>(false);
  const [isStampPickerOpen, setIsStampPickerOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Active Toast Feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const showToast = useCallback((text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 2400);
  }, []);

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
    saveStatus,
    addAnnotation,
    addAttachedImage,
    updateAnnotation,
    deleteAnnotation,
    clearAllAnnotationsForPage,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useAnnotations(docKey, docInfo);

  const {
    snippets,
    addSnippet,
    addDivider,
    removeEntry: removeSnippetEntry,
    moveEntry: moveSnippetEntry,
    updateDivider,
    updateSnippetLabel,
    clearAll: clearAllSnippets,
  } = useSnippets(docKey);

  const {
    settings: themeSettings,
    setTheme,
    toggleInvert,
    updateSetting: updateThemeSetting,
    resetFilters: resetThemeFilters,
    getPageFilterClass,
    getCustomFilterStyle,
  } = useColorTheme();

  const isDarkTheme = usesInvertedColorSpace(themeSettings.theme);

  useEffect(() => {
    document.documentElement.dataset.uiTheme = isDarkTheme ? 'dark' : 'light';
    return () => {
      delete document.documentElement.dataset.uiTheme;
    };
  }, [isDarkTheme]);

  // Load a demo PDF on initial startup if none is loaded
  useEffect(() => {
    const initDemo = async () => {
      const sampleBytes = await createSamplePDF();
      loadPdf(sampleBytes, 'Welcome-Document.pdf');
    };
    initDemo();
  }, [loadPdf]);

  // Handle View Mode persistence
  const handleChangeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    saveViewMode(mode);
  };

  // Open PDF File (Desktop native dialog or Browser File Input fallback)
  const handleOpenPdf = async () => {
    if (isTauri()) {
      const fileData = await tauriOpenPdf();
      if (fileData) {
        recordRecentDoc({
          fileName: fileData.fileName,
          filePath: fileData.filePath,
          fileSize: fileData.data.byteLength,
          modifiedTimestamp: Date.now(),
        });
        loadPdf(fileData.data, fileData.fileName, fileData.filePath);
        setCurrentScreen('reader');
      }
    } else {
      pdfInputRef.current?.click();
    }
  };

  const handlePdfInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          const bytes = new Uint8Array(reader.result);
          recordRecentDoc({
            fileName: file.name,
            filePath: file.name,
            fileSize: file.size,
            modifiedTimestamp: file.lastModified || Date.now(),
          });
          loadPdf(bytes, file.name);
          setCurrentScreen('reader');
        }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = '';
  };

  // Unified image addition handler that measures natural dimensions and places image with exact aspect ratio
  const handleAddImage = useCallback(
    async (
      dataUrl: string,
      targetPage: number,
      fileName: string = 'Attached Image',
      cursorPos?: { x: number; y: number } | null
    ) => {
      try {
        const { width: imgW, height: imgH, aspectRatio } = await getImageDimensions(dataUrl);
        let pageW = 595;
        let pageH = 842;
        if (pdfDoc) {
          try {
            const page = await pdfDoc.getPage(targetPage);
            const vp = page.getViewport({ scale: 1.0 });
            pageW = vp.width;
            pageH = vp.height;
          } catch {}
        }

        addAttachedImage(targetPage, dataUrl, aspectRatio, fileName, {
          x: cursorPos ? cursorPos.x : undefined,
          y: cursorPos ? cursorPos.y : undefined,
          pageWidth: pageW,
          pageHeight: pageH,
          imageWidth: imgW,
          imageHeight: imgH,
          attachedInInvertedMode: isDarkTheme,
          invertInLightMode: isDarkTheme,
        });
        setActiveTool('select');
      } catch (err) {
        console.error('Failed to attach image:', err);
      }
    },
    [pdfDoc, addAttachedImage, isDarkTheme]
  );

  // Open Image to Attach (Desktop native dialog or Browser File Input fallback)
  const handleOpenImage = async () => {
    if (isTauri()) {
      const imgData = await tauriOpenImage();
      if (imgData) {
        const targetPage = cursorPosRef.current ? cursorPosRef.current.pageNumber : currentPage;
        const cursorPos = cursorPosRef.current ? { x: cursorPosRef.current.x, y: cursorPosRef.current.y } : null;
        await handleAddImage(imgData.dataUrl, targetPage, imgData.fileName, cursorPos);
      }
    } else {
      imageInputRef.current?.click();
    }
  };

  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === 'string') {
          const targetPage = cursorPosRef.current ? cursorPosRef.current.pageNumber : currentPage;
          const cursorPos = cursorPosRef.current ? { x: cursorPosRef.current.x, y: cursorPosRef.current.y } : null;
          await handleAddImage(reader.result, targetPage, file.name, cursorPos);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // Handle Drag & Drop of image directly onto a page canvas
  const handleImageDropOnPage = (pageNumber: number, file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const cursorPos =
          cursorPosRef.current && cursorPosRef.current.pageNumber === pageNumber
            ? { x: cursorPosRef.current.x, y: cursorPosRef.current.y }
            : { x: 0.5, y: 0.5 };
        await handleAddImage(reader.result, pageNumber, file.name, cursorPos);
      }
    };
    reader.readAsDataURL(file);
  };

  // Tool selection handler that syncs sidebar when snip tool is selected
  const handleSelectTool = useCallback((tool: ToolType) => {
    setActiveTool(tool);
    if (tool === 'snip') {
      setIsSidebarOpen(true);
      setSidebarTab('snippets');
    }
  }, []);

  // Snippet capture handler from canvas
  const handleCaptureSnippet = useCallback(
    async (pageNumber: number, rect: { x: number; y: number; width: number; height: number }) => {
      try {
        const entry = await cropCanvasRegion(pageNumber, rect, pdfDoc);
        if (entry) {
          addSnippet(entry);
          setIsSidebarOpen(true);
          setSidebarTab('snippets');
          showToast(`Captured snippet from Page ${pageNumber}!`);
        }
      } catch (err) {
        console.error('Failed to capture snippet:', err);
        showToast('Failed to capture snippet', true);
      }
    },
    [pdfDoc, addSnippet, showToast]
  );

  const handleCopyStitchedSnippets = useCallback(
    async (options?: StitchOptions) => {
      return await copyStitchedSnippetsToClipboard(snippets, options);
    },
    [snippets]
  );

  const handleDownloadStitchedSnippets = useCallback(
    async (options?: StitchOptions) => {
      const baseName = docInfo?.fileName || 'document';
      return await downloadStitchedSnippets(snippets, baseName, options);
    },
    [snippets, docInfo]
  );

  // Extract and Copy all text from a page
  const handleCopyPageText = useCallback(
    async (pageParam?: number | unknown) => {
      const pageNumber = typeof pageParam === 'number' && !isNaN(pageParam) ? pageParam : currentPage;
      if (!pdfDoc) return;
      try {
        const fullText = await extractPageText(pdfDoc, pageNumber);
        if (!fullText) {
          showToast(`No text found on Page ${pageNumber}.`, true);
          return;
        }

        const copied = await copyTextToClipboard(fullText);
        if (copied) {
          const wordCount = fullText.split(/\s+/).filter(Boolean).length;
          showToast(`Copied ${wordCount} words from Page ${pageNumber}!`);
        } else {
          showToast(`Could not copy to clipboard.`, true);
        }
      } catch (err) {
        console.error('Failed to copy page text:', err);
        showToast(`Failed to extract page text.`, true);
      }
    },
    [pdfDoc, currentPage, showToast]
  );

  // Copy active page directly to clipboard as image
  const handleCopyPageJpg = useCallback(
    async (pageParam?: number | unknown) => {
      const pageNumber = typeof pageParam === 'number' && !isNaN(pageParam) ? pageParam : currentPage;
      if (!pdfDoc) return;
      try {
        const copiedToClipboard = await copyPageImageToClipboard(pageNumber, pdfDoc);
        if (copiedToClipboard) {
          showToast(`Page ${pageNumber} image copied to clipboard!`);
        } else {
          showToast(`Could not copy image to clipboard.`, true);
        }
      } catch (err) {
        console.error('Failed to copy page image:', err);
        showToast(`Failed to capture page image.`, true);
      }
    },
    [pdfDoc, currentPage, showToast]
  );

  // Cursor-aware Clipboard Paste: Pastes image at mouse cursor position on hovered page
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = async () => {
            if (typeof reader.result === 'string') {
              const targetPage = cursorPosRef.current ? cursorPosRef.current.pageNumber : currentPage;
              const cursorPos = cursorPosRef.current ? { x: cursorPosRef.current.x, y: cursorPosRef.current.y } : null;

              await handleAddImage(reader.result, targetPage, 'Pasted-Image', cursorPos);
              showToast(`Pasted image on Page ${targetPage}!`);
            }
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [currentPage, handleAddImage, showToast]);

  // Global Keyboard Shortcuts
  useKeyboard({
    onOpenPdf: handleOpenPdf,
    onSavePdf: () => setIsExportModalOpen(true),
    onSaveJson: () => setIsExportModalOpen(true),
    onToggleInvert: toggleInvert,
    onToggleSearch: () => setIsSearchOpen((prev) => !prev),
    onSelectTool: handleSelectTool,
    onUndo: undo,
    onRedo: redo,
    onZoomIn: () => setZoom((z) => Math.min(3.5, z + 0.15)),
    onZoomOut: () => setZoom((z) => Math.max(0.3, z - 0.15)),
    onResetZoom: () => setZoom(1.15),
    onNextPage: () => changePage(currentPage + 1),
    onPrevPage: () => changePage(currentPage - 1),
    onToggleZen: () => setIsZenMode((prev) => !prev),
    onToggleShortcuts: () => setIsShortcutsModalOpen((prev) => !prev),
    onToggleLibrary: () =>
      setCurrentScreen((prev) => (prev === 'dashboard' ? 'reader' : 'dashboard')),
    onCopyPageText: () => handleCopyPageText(currentPage),
    onCopyPageJpg: () => handleCopyPageJpg(currentPage),
  });

  return (
    <div
      data-ui-theme={isDarkTheme ? 'dark' : 'light'}
      className="macos-window h-screen w-screen flex flex-col bg-[#1e1e24] text-[#f0f0f4] overflow-hidden select-none transition-colors duration-200"
    >
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

      {/* Floating Dynamic Feedback Toast */}
      {toastMessage && (
        <div className="fixed top-13 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#26262e]/95 border border-[#3e3e4c] text-xs text-zinc-100 shadow-2xl backdrop-blur-md animate-slide-down pointer-events-none">
          {toastMessage.isError ? (
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          ) : (
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <span className="font-medium">{toastMessage.text}</span>
        </div>
      )}

      {/* VIEW 1: DASHBOARD & SAVED DIRECTORIES LIBRARY */}
      {currentScreen === 'dashboard' ? (
        <Dashboard
          hasActiveDoc={!!pdfDoc}
          activeDocName={docInfo?.fileName}
          isDarkTheme={isDarkTheme}
          onToggleTheme={toggleInvert}
          onSwitchToReader={() => setCurrentScreen('reader')}
          onOpenPdf={(data, fileName, filePath, initialPage) => {
            loadPdf(data, fileName, filePath, initialPage);
            setCurrentScreen('reader');
          }}
        />
      ) : (
        /* VIEW 2: FULL READER & ANNOTATION STUDIO */
        <>
          {/* Top Header & Titlebar */}
          <Header
            docInfo={docInfo}
            currentPage={currentPage}
            numPages={pdfDoc?.numPages || 0}
            zoom={zoom}
            viewMode={viewMode}
            theme={themeSettings.theme}
            isZenMode={isZenMode}
            isSearchOpen={isSearchOpen}
            annotationCount={annotations.length}
            saveStatus={saveStatus}
            onOpenDashboard={() => setCurrentScreen('dashboard')}
            onExportClick={() => setIsExportModalOpen(true)}
            onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
            onToggleInvert={toggleInvert}
            onOpenThemeModal={() => setIsThemeModalOpen(true)}
            onToggleZen={() => setIsZenMode((prev) => !prev)}
            onToggleShortcuts={() => setIsShortcutsModalOpen(true)}
            onChangeViewMode={handleChangeViewMode}
            onChangeZoom={(newZoom) => setZoom(newZoom)}
            onPageChange={(p) => changePage(p)}
            onCopyPageText={() => handleCopyPageText(currentPage)}
            onCopyPageJpg={() => handleCopyPageJpg(currentPage)}
          />

          {/* Main Reading & Sidebar Workspace */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Navigation Sidebar */}
            <Sidebar
              isOpen={isSidebarOpen && !isZenMode}
              activeTab={sidebarTab}
              onTabChange={setSidebarTab}
              pdfDoc={pdfDoc}
              docInfo={docInfo}
              outline={outline}
              currentPage={currentPage}
              numPages={pdfDoc?.numPages || 0}
              annotations={annotations}
              filterClass={getPageFilterClass()}
              customFilterStyle={getCustomFilterStyle()}
              onClose={() => setIsSidebarOpen(false)}
              onPageSelect={(p) => changePage(p)}
              onDeleteAnnotation={(id) => deleteAnnotation(id)}
              snippets={snippets}
              isSnipActive={activeTool === 'snip'}
              onToggleSnipTool={() => handleSelectTool(activeTool === 'snip' ? 'select' : 'snip')}
              onAddDivider={addDivider}
              onRemoveSnippetEntry={removeSnippetEntry}
              onMoveSnippetEntry={moveSnippetEntry}
              onUpdateDivider={updateDivider}
              onUpdateSnippetLabel={updateSnippetLabel}
              onClearAllSnippets={clearAllSnippets}
              onCopyStitchedImage={handleCopyStitchedSnippets}
              onDownloadStitchedImage={handleDownloadStitchedSnippets}
              showToast={showToast}
            />

            {!isSidebarOpen && !isZenMode && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="macos-sidebar-collapse-control canvas-sidebar-toggle"
                title="Show Sidebar"
              >
                <SidebarIcon className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Primary PDF Canvas Viewport */}
            <div className="flex-1 min-w-0 relative overflow-hidden flex">
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
                onCaptureSnippet={handleCaptureSnippet}
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
                onChangeZoom={(newZoom) => setZoom(newZoom)}
              />

              {pdfDoc && (
                <div
                  className="reader-progress"
                  role="progressbar"
                  aria-label="Reading progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round((currentPage / pdfDoc.numPages) * 100)}
                >
                  <div className="reader-progress-label">
                    {Math.round((currentPage / pdfDoc.numPages) * 100)}% read
                  </div>
                  <div className="reader-progress-track">
                    <div
                      className="reader-progress-value"
                      style={{ width: `${(currentPage / pdfDoc.numPages) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Floating Tool Dock */}
          {pdfDoc && !isZenMode && (
            <Toolbar
              activeTool={activeTool}
              selectedColor={selectedColor}
              isInvertedColorMode={isDarkTheme}
              strokeWidth={strokeWidth}
              opacity={opacity}
              canUndo={canUndo}
              canRedo={canRedo}
              onSelectTool={handleSelectTool}
              onSelectColor={(c) => setSelectedColor(c)}
              onChangeStrokeWidth={(w) => setStrokeWidth(w)}
              onChangeOpacity={(o) => setOpacity(o)}
              onAttachImageClick={handleOpenImage}
              onOpenStampPicker={() => setIsStampPickerOpen(true)}
              onUndo={undo}
              onRedo={redo}
              onClearPageAnnotations={() => clearAllAnnotationsForPage(currentPage)}
            />
          )}

          {/* In-Document Quick Search HUD */}
          <SearchBar
            isOpen={isSearchOpen}
            isSearching={isSearching}
            searchResults={searchResults}
            currentMatchIndex={currentMatchIndex}
            onSearch={searchInDocument}
            onNext={nextSearchResult}
            onPrev={prevSearchResult}
            onClose={() => setIsSearchOpen(false)}
          />

          {/* Reading Theme & Brightness Modal */}
          <ColorThemeModal
            isOpen={isThemeModalOpen}
            settings={themeSettings}
            onClose={() => setIsThemeModalOpen(false)}
            onSelectTheme={setTheme}
            onUpdateSetting={updateThemeSetting}
            onResetFilters={resetThemeFilters}
          />

          {/* Stamp & Badge Picker Modal */}
          <StampPickerModal
            isOpen={isStampPickerOpen}
            onClose={() => setIsStampPickerOpen(false)}
            onSelectStamp={async (dataUrl, name) => {
              const targetPage = cursorPosRef.current ? cursorPosRef.current.pageNumber : currentPage;
              const cursorPos = cursorPosRef.current ? { x: cursorPosRef.current.x, y: cursorPosRef.current.y } : null;
              await handleAddImage(dataUrl, targetPage, name, cursorPos);
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
        </>
      )}
    </div>
  );
}

export default App;
