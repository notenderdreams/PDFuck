import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { PDFViewer } from './components/PDFViewer';
import { Dashboard } from './components/Dashboard';
import { ColorThemeModal } from './components/ColorThemeModal';
import { SearchBar } from './components/SearchBar';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { ExportModal } from './components/ExportModal';
import { DeletePageConfirmationDialog } from './components/DeletePageConfirmationDialog';
import { Check, Info, LoaderCircle, Sidebar as SidebarIcon } from 'lucide-react';

import { usePDFDocument } from './hooks/usePDFDocument';
import { useAnnotations } from './hooks/useAnnotations';
import { useSnippets } from './hooks/useSnippets';
import { useColorTheme } from './hooks/useColorTheme';
import { useAiExplanations } from './hooks/useAiExplanations';
import { usesInvertedColorSpace } from './utils/readingTheme';
import { useKeyboard } from './hooks/useKeyboard';
import {
  loadHighlightPalette,
  loadViewMode,
  recordRecentDoc,
  saveHighlightPalette,
  saveViewMode,
} from './utils/storage';
import { isTauri, tauriOpenPdf, tauriOpenImage, tauriWritePdf } from './utils/tauriBridge';
import {
  extractPageText,
  copyTextToClipboard,
  copyPageImageToClipboard,
  deletePageFromPdf,
  reindexAfterPageDeletion,
  downloadPageAsJpg,
} from './utils/pageExtractor';
import { getImageDimensions } from './utils/imageUtils';
import { createTextHighlightsFromSelection } from './utils/textHighlight';
import {
  HIGHLIGHT_COLOR_PRESETS,
  replaceHighlightPaletteColor,
} from './utils/highlightStyle';
import {
  cropCanvasRegion,
  copyStitchedSnippetsToClipboard,
  downloadStitchedSnippets,
} from './utils/snippetExtractor';
import type { AiExplanationAnnotation, Annotation, AppScreen, HighlightStyle, LineHighlightStyle, ToolType, ViewMode, StitchOptions } from './utils/types';
import type { SidebarTabType } from './components/Sidebar';

export function App() {
  // Screen Routing: 'dashboard' (Library view) | 'reader' (PDF reader & annotation studio)
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('dashboard');

  // View & UI State
  const [zoom, setZoom] = useState<number>(1.15);
  const [fitPageRequest, setFitPageRequest] = useState<{ id: number; page: number } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadViewMode());
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTabType>('thumbnails');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [pagePendingDeletion, setPagePendingDeletion] = useState<number | null>(null);
  const [isDeletingPage, setIsDeletingPage] = useState<boolean>(false);

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
  const [initialHighlightPalette] = useState(() =>
    loadHighlightPalette(HIGHLIGHT_COLOR_PRESETS)
  );
  const [highlightColors, setHighlightColors] = useState<string[]>(
    initialHighlightPalette.colors
  );
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState(
    initialHighlightPalette.selectedIndex
  );
  const [selectedColor, setSelectedColor] = useState<string>(
    initialHighlightPalette.colors[initialHighlightPalette.selectedIndex]
  );
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [opacity, setOpacity] = useState<number>(0.45);
  const [highlightStyle, setHighlightStyle] = useState<HighlightStyle>('box');
  const [lineHighlightStyle, setLineHighlightStyle] = useState<LineHighlightStyle>('highlight');
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  useEffect(() => {
    saveHighlightPalette({ colors: highlightColors, selectedIndex: selectedPaletteIndex });
  }, [highlightColors, selectedPaletteIndex]);

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
    isLoading,
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
    replaceAnnotations,
    undo: undoAnnotations,
    redo: redoAnnotations,
    canUndo: canUndoAnnotations,
    canRedo: canRedoAnnotations,
  } = useAnnotations(docKey, docInfo);

  const aiExplanations = useAiExplanations({
    pdfDoc,
    documentName: docInfo?.fileName || 'document.pdf',
    docKey,
    updateAnnotation,
  });

  const {
    snippets,
    addSnippet,
    addDivider,
    removeEntry: removeSnippetEntry,
    moveEntry: moveSnippetEntry,
    updateDivider,
    updateSnippetLabel,
    clearAll: clearAllSnippets,
    undo: undoSnippets,
    redo: redoSnippets,
    canUndo: canUndoSnippets,
    canRedo: canRedoSnippets,
    replaceSnippets,
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

  const [pageNavRequest, setPageNavRequest] = useState<{ page: number; timestamp: number } | null>(null);

  const handleNavigatePage = useCallback(
    (page: number) => {
      changePage(page);
      setPageNavRequest({ page, timestamp: Date.now() });
    },
    [changePage]
  );

  const isDarkTheme = usesInvertedColorSpace(themeSettings.theme);

  const handleSelectAnnotation = useCallback((id: string | null) => {
    setSelectedAnnotationId(id);
    if (!id) return;

    const selectedAnnotation = annotations.find((annotation) => annotation.id === id);
    if (
      selectedAnnotation &&
      (selectedAnnotation.type === 'highlight-line' ||
        selectedAnnotation.type === 'highlight-pen' ||
        selectedAnnotation.type === 'highlight-rect' ||
        selectedAnnotation.type === 'highlight-text')
    ) {
      setSelectedColor(selectedAnnotation.color);
      const paletteIndex = highlightColors.findIndex(
        (color) => color.toLowerCase() === selectedAnnotation.color.toLowerCase()
      );
      if (paletteIndex >= 0) setSelectedPaletteIndex(paletteIndex);
    }
  }, [annotations, highlightColors]);

  useEffect(() => {
    document.documentElement.dataset.uiTheme = isDarkTheme ? 'dark' : 'light';
    return () => {
      delete document.documentElement.dataset.uiTheme;
    };
  }, [isDarkTheme]);

  // Handle View Mode persistence
  const handleChangeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    saveViewMode(mode);
  };

  const openPdfInReader = useCallback(
    async (
      data: Uint8Array | ArrayBuffer,
      fileName: string,
      filePath?: string,
      initialPage?: number
    ) => {
      const loaded = await loadPdf(data, fileName, filePath, initialPage);
      if (loaded) setCurrentScreen('reader');
      else showToast(`Could not open ${fileName}.`, true);
      return loaded;
    },
    [loadPdf, showToast]
  );

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
        await openPdfInReader(fileData.data, fileData.fileName, fileData.filePath);
      }
    } else {
      pdfInputRef.current?.click();
    }
  };

  const handlePdfInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        if (reader.result instanceof ArrayBuffer) {
          const bytes = new Uint8Array(reader.result);
          recordRecentDoc({
            fileName: file.name,
            filePath: file.name,
            fileSize: file.size,
            modifiedTimestamp: file.lastModified || Date.now(),
          });
          await openPdfInReader(bytes, file.name);
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

  // Quick keyboard shortcut handler to copy stitched snippets
  const handleQuickCopyStitched = useCallback(async () => {
    if (snippets.length === 0) {
      showToast('No snippets to copy. Snip an area with C first.', true);
      return;
    }
    const ok = await copyStitchedSnippetsToClipboard(snippets);
    if (ok) {
      showToast(`Copied ${snippets.length} stitched snippets to clipboard!`);
    } else {
      showToast('Failed to copy stitched image', true);
    }
  }, [snippets, showToast]);

  // Quick keyboard shortcut handler to dump all snippets
  const handleQuickDumpSnippets = useCallback(() => {
    if (snippets.length === 0) {
      showToast('Snippet compactor is already empty.');
      return;
    }
    const count = snippets.length;
    clearAllSnippets();
    showToast(`Dumped all ${count} snippets from compactor.`);
  }, [snippets.length, clearAllSnippets, showToast]);

  // Contextual Global Undo handler
  const handleGlobalUndo = useCallback(() => {
    if (activeTool === 'snip' || sidebarTab === 'snippets') {
      if (canUndoSnippets) {
        undoSnippets();
        showToast('Undid snippet change');
        return;
      }
    }
    if (canUndoAnnotations) {
      undoAnnotations();
      showToast('Undid annotation');
    } else if (canUndoSnippets) {
      undoSnippets();
      showToast('Undid snippet change');
    }
  }, [
    activeTool,
    sidebarTab,
    canUndoSnippets,
    canUndoAnnotations,
    undoSnippets,
    undoAnnotations,
    showToast,
  ]);

  // Contextual Global Redo handler
  const handleGlobalRedo = useCallback(() => {
    if (activeTool === 'snip' || sidebarTab === 'snippets') {
      if (canRedoSnippets) {
        redoSnippets();
        showToast('Redid snippet change');
        return;
      }
    }
    if (canRedoAnnotations) {
      redoAnnotations();
      showToast('Redid annotation');
    } else if (canRedoSnippets) {
      redoSnippets();
      showToast('Redid snippet change');
    }
  }, [
    activeTool,
    sidebarTab,
    canRedoSnippets,
    canRedoAnnotations,
    redoSnippets,
    redoAnnotations,
    showToast,
  ]);

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

  const handleAskAiAboutPage = useCallback(
    (pageNumber: number) => {
      if (!pdfDoc) return;
      const now = Date.now();
      const annotation: AiExplanationAnnotation = {
        id: `ai_page_${now}_${Math.random().toString(36).slice(2, 7)}`,
        pageNumber,
        type: 'ai-explanation',
        x: 0.01,
        y: 0.01,
        width: 0.98,
        height: 0.98,
        prompt: '',
        response: '',
        provider: 'codex',
        createdAt: now,
        updatedAt: now,
      };

      addAnnotation(annotation);
      aiExplanations.openComposer(annotation.id);
      setSelectedAnnotationId(annotation.id);
      setActiveTool('select');
    },
    [addAnnotation, aiExplanations.openComposer, pdfDoc]
  );

  const requestDeletePage = useCallback(
    (pageNumber: number) => {
      if (!pdfDoc || !rawPdfBytes || !docInfo) return;
      if (pdfDoc.numPages <= 1) {
        showToast('A PDF must keep at least one page.', true);
        return;
      }
      setPagePendingDeletion(pageNumber);
    },
    [docInfo, pdfDoc, rawPdfBytes, showToast]
  );

  const handleDeletePage = useCallback(
    async () => {
      const pageNumber = pagePendingDeletion;
      if (pageNumber === null) return;
      if (!pdfDoc || !rawPdfBytes || !docInfo) return;
      if (pdfDoc.numPages <= 1) {
        showToast('A PDF must keep at least one page.', true);
        setPagePendingDeletion(null);
        return;
      }

      // Close the confirmation dialog immediately so the user can continue uninterrupted
      setPagePendingDeletion(null);
      setIsDeletingPage(true);
      await new Promise((resolve) => setTimeout(resolve, 0));

      try {
        const updatedBytes = await deletePageFromPdf(rawPdfBytes, pageNumber);
        const updatedAnnotations = reindexAfterPageDeletion(annotations, pageNumber);
        const updatedSnippets = reindexAfterPageDeletion(snippets, pageNumber);
        const nextPage = Math.min(pageNumber, pdfDoc.numPages - 1);

        if (isTauri() && docInfo.filePath) {
          const persisted = await tauriWritePdf(updatedBytes, docInfo.filePath);
          if (!persisted) {
            showToast('Could not save the page deletion to the PDF.', true);
            return;
          }
        }

        const reloaded = await loadPdf(
          updatedBytes,
          docInfo.fileName,
          docInfo.filePath,
          nextPage,
          docKey,
          docInfo.fingerprint,
          true
        );
        if (!reloaded) {
          showToast('Could not reload the PDF after deleting the page.', true);
          return;
        }

        replaceAnnotations(updatedAnnotations);
        replaceSnippets(updatedSnippets);
        setSelectedAnnotationId(null);
        cursorPosRef.current = null;
        setPageNavRequest({ page: nextPage, timestamp: Date.now() });
        showToast(
          isTauri() && docInfo.filePath
            ? `Page ${pageNumber} deleted and changes saved`
            : `Page ${pageNumber} deleted`
        );
      } catch (error) {
        console.error('Failed to delete PDF page:', error);
        showToast('Could not delete the page.', true);
      } finally {
        setIsDeletingPage(false);
      }
    },
    [
      annotations,
      docInfo,
      docKey,
      loadPdf,
      pagePendingDeletion,
      pdfDoc,
      rawPdfBytes,
      replaceAnnotations,
      replaceSnippets,
      showToast,
      snippets,
    ]
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

  const addHighlightsFromSelection = useCallback((style: HighlightStyle, showEmptyToast: boolean) => {
    const selection = window.getSelection();
    const highlights = createTextHighlightsFromSelection(
      selection,
      selectedColor,
      opacity,
      style
    );

    if (highlights.length === 0) {
      if (showEmptyToast) showToast('Select PDF text first', true);
      return false;
    }

    highlights.forEach(addAnnotation);
    selection?.removeAllRanges();
    const location = highlights.length === 1
      ? `Page ${highlights[0].pageNumber}`
      : `${highlights.length} pages`;
    showToast(`${style === 'underline' ? 'Underlined' : 'Highlighted'} selected text on ${location}`);
    return true;
  }, [addAnnotation, opacity, selectedColor, showToast]);

  const handleHighlightSelectedText = useCallback(() => {
    addHighlightsFromSelection(highlightStyle, true);
  }, [addHighlightsFromSelection, highlightStyle]);

  const handleUnderlineShortcut = useCallback(() => {
    if (addHighlightsFromSelection('underline', false)) return;
    handleSelectTool('highlight-line');
    setLineHighlightStyle('underline');
  }, [addHighlightsFromSelection, handleSelectTool]);

  // Global Keyboard Shortcuts
  useKeyboard({
    onOpenPdf: handleOpenPdf,
    onSavePdf: () => setIsExportModalOpen(true),
    onSaveJson: () => setIsExportModalOpen(true),
    onToggleInvert: toggleInvert,
    onToggleSearch: () => setIsSearchOpen((prev) => !prev),
    onSelectTool: handleSelectTool,
    onSelectLineTool: () => {
      handleSelectTool('highlight-line');
      setLineHighlightStyle('highlight');
    },
    onSelectUnderlineTool: handleUnderlineShortcut,
    onSelectHighlightColor: (index) => {
      const color = highlightColors[index];
      if (!color) return;

      setSelectedPaletteIndex(index);
      setSelectedColor(color);
      const selectedAnnotation = annotations.find(({ id }) => id === selectedAnnotationId);
      if (
        selectedAnnotation &&
        (selectedAnnotation.type === 'highlight-line' ||
          selectedAnnotation.type === 'highlight-pen' ||
          selectedAnnotation.type === 'highlight-rect' ||
          selectedAnnotation.type === 'highlight-text')
      ) {
        updateAnnotation(selectedAnnotation.id, { color });
      }
    },
    onUndo: handleGlobalUndo,
    onRedo: handleGlobalRedo,
    onZoomIn: () => setZoom((z) => Math.min(3.5, z + 0.15)),
    onZoomOut: () => setZoom((z) => Math.max(0.3, z - 0.15)),
    onResetZoom: () => setZoom(1.15),
    onNextPage: () => {
      const spreadStart = currentPage % 2 === 0 ? currentPage - 1 : currentPage;
      handleNavigatePage(viewMode === 'spread' ? spreadStart + 2 : currentPage + 1);
    },
    onPrevPage: () => {
      const spreadStart = currentPage % 2 === 0 ? currentPage - 1 : currentPage;
      handleNavigatePage(viewMode === 'spread' ? Math.max(1, spreadStart - 2) : currentPage - 1);
    },
    onToggleZen: () => setIsZenMode((prev) => !prev),
    onToggleSidebar: () => {
      if (currentScreen === 'reader') {
        setIsSidebarOpen((prev) => !prev);
      }
    },
    onToggleShortcuts: () => setIsShortcutsModalOpen((prev) => !prev),
    onChangeViewMode: handleChangeViewMode,
    onToggleLibrary: () =>
      setCurrentScreen((prev) => (prev === 'dashboard' ? 'reader' : 'dashboard')),
    onCopyPageText: () => handleCopyPageText(currentPage),
    onCopyPageJpg: () => handleCopyPageJpg(currentPage),
    onCopyStitchedSnippets: handleQuickCopyStitched,
    onClearSnippets: handleQuickDumpSnippets,
    onHighlightSelectedText: handleHighlightSelectedText,
    onDeleteSelectedAnnotation: () => {
      if (selectedAnnotationId) {
        deleteAnnotation(selectedAnnotationId);
        setSelectedAnnotationId(null);
      }
    },
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

      {isLoading && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-label="Opening PDF"
        >
          <div className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--popover)] px-4 py-2.5 text-xs font-medium text-zinc-200 shadow-xl">
            <LoaderCircle className="h-4 w-4 animate-spin text-blue-500" />
            <span>Opening PDF…</span>
          </div>
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
          onOpenPdf={openPdfInReader}
          themeSettings={themeSettings}
          onSelectTheme={setTheme}
          onUpdateThemeSetting={updateThemeSetting}
          onResetThemeFilters={resetThemeFilters}
          viewMode={viewMode}
          onChangeViewMode={handleChangeViewMode}
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
            onChangeZoom={setZoom}
            onFitPage={() =>
              setFitPageRequest((request) => ({
                id: (request?.id ?? 0) + 1,
                page: currentPage,
              }))
            }
            onPageChange={handleNavigatePage}
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
              onPageSelect={handleNavigatePage}
              onSelectAnnotation={handleSelectAnnotation}
              onDeleteAnnotation={(id) => deleteAnnotation(id)}
              snippets={snippets}
              isSnipActive={activeTool === 'snip'}
              canUndoSnippets={canUndoSnippets}
              canRedoSnippets={canRedoSnippets}
              onUndoSnippets={undoSnippets}
              onRedoSnippets={redoSnippets}
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

            {!isZenMode && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className={`macos-sidebar-collapse-control canvas-sidebar-toggle transition-all duration-200 ease-out ${
                  !isSidebarOpen
                    ? 'opacity-100 translate-x-0 pointer-events-auto'
                    : 'opacity-0 -translate-x-3 pointer-events-none'
                }`}
                title="Show Sidebar"
              >
                <SidebarIcon className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Primary PDF Canvas Viewport */}
            <div className="flex-1 min-w-0 relative overflow-hidden flex bg-[var(--workspace)]">
              <PDFViewer
                pdfDoc={pdfDoc}
                rawPdfBytes={rawPdfBytes}
                currentPage={currentPage}
                numPages={pdfDoc?.numPages || 0}
                pageNavRequest={pageNavRequest}
                zoom={zoom}
                viewMode={viewMode}
                currentTheme={themeSettings.theme}
                filterClass={getPageFilterClass()}
                customFilterStyle={getCustomFilterStyle()}
                activeTool={activeTool}
                selectedColor={selectedColor}
                highlightColors={highlightColors}
                strokeWidth={strokeWidth}
                opacity={opacity}
                highlightStyle={highlightStyle}
                lineHighlightStyle={lineHighlightStyle}
                annotations={annotations}
                selectedAnnotationId={selectedAnnotationId}
                onPageChange={(p) => changePage(p)}
                onSelectAnnotation={handleSelectAnnotation}
                onAddAnnotation={(ann) => addAnnotation(ann)}
                onUpdateAnnotation={(id, up) => updateAnnotation(id, up)}
                onChangeHighlightStyle={setHighlightStyle}
                onChangeLineHighlightStyle={setLineHighlightStyle}
                onDeleteAnnotation={(id) => deleteAnnotation(id)}
                onImageDrop={handleImageDropOnPage}
                onCursorMove={(page, x, y) => {
                  cursorPosRef.current = { pageNumber: page, x, y };
                }}
                onCaptureSnippet={handleCaptureSnippet}
                aiJobs={aiExplanations.jobs}
                onAiBoxCreated={(id) => {
                  setSelectedAnnotationId(id);
                  aiExplanations.openComposer(id);
                  setActiveTool('select');
                }}
                onSubmitAi={(annotation, prompt) => void aiExplanations.submit(annotation, prompt)}
                onCancelAi={(annotationId) => void aiExplanations.cancel(annotationId)}
                onCloseAi={aiExplanations.close}
                onDeletePage={requestDeletePage}
                onCopyPageText={(pageNumber) => void handleCopyPageText(pageNumber)}
                onCopyPageImage={(pageNumber) => void handleCopyPageJpg(pageNumber)}
                onAskAiAboutPage={handleAskAiAboutPage}
                onPdfFileDrop={(file) => {
                  const reader = new FileReader();
                  reader.onload = async () => {
                    if (reader.result instanceof ArrayBuffer) {
                      await openPdfInReader(new Uint8Array(reader.result), file.name);
                    }
                  };
                  reader.readAsArrayBuffer(file);
                }}
                onOpenPdfClick={handleOpenPdf}
                onChangeZoom={setZoom}
                fitPageRequest={fitPageRequest}
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
              colorPresets={highlightColors}
              isInvertedColorMode={isDarkTheme}
              strokeWidth={strokeWidth}
              opacity={opacity}
              highlightStyle={highlightStyle}
              lineHighlightStyle={lineHighlightStyle}
              canUndo={activeTool === 'snip' ? canUndoSnippets : canUndoAnnotations}
              canRedo={activeTool === 'snip' ? canRedoSnippets : canRedoAnnotations}
              onSelectTool={handleSelectTool}
              onSelectColor={(c, index) => {
                setSelectedPaletteIndex(index);
                setSelectedColor(c);
                if (selectedAnnotationId) {
                  updateAnnotation(selectedAnnotationId, { color: c });
                }
              }}
              onReplaceSelectedColor={(c) => {
                setHighlightColors((colors) =>
                  replaceHighlightPaletteColor(colors, selectedPaletteIndex, c)
                );
                setSelectedColor(c);
                if (selectedAnnotationId) {
                  updateAnnotation(selectedAnnotationId, { color: c });
                }
              }}
              onChangeStrokeWidth={(w) => setStrokeWidth(w)}
              onChangeOpacity={(o) => setOpacity(o)}
              onChangeHighlightStyle={setHighlightStyle}
              onChangeLineHighlightStyle={setLineHighlightStyle}
              onAttachImageClick={handleOpenImage}
              onUndo={handleGlobalUndo}
              onRedo={handleGlobalRedo}
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

      <DeletePageConfirmationDialog
        pageNumber={pagePendingDeletion}
        isDeleting={isDeletingPage}
        onCancel={() => setPagePendingDeletion(null)}
        onConfirm={() => void handleDeletePage()}
      />
    </div>
  );
}

export default App;
