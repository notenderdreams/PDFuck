import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Annotation, AttachedImageAnnotation, DocumentInfo } from '../utils/types';
import {
  loadAnnotationsForDocAsync,
  loadAnnotationsForDocSync,
  saveAnnotationsForDoc,
} from '../utils/storage';

import { calculateImagePlacement, type ImagePlacementOptions } from '../utils/imageUtils';

export function useAnnotations(docKey: string, docInfo?: DocumentInfo | null) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const isLoadedRef = useRef<boolean>(false);

  const fallbackKeys = useMemo(() => {
    const keys: string[] = [];
    if (docInfo?.filePath) keys.push(docInfo.filePath);
    if (docInfo?.fileName) keys.push(docInfo.fileName);
    if (docInfo?.fingerprint) keys.push(docInfo.fingerprint);
    return keys;
  }, [docInfo?.filePath, docInfo?.fileName, docInfo?.fingerprint]);

  // Load annotations on docKey or document identity change
  useEffect(() => {
    if (!docKey) return;
    isLoadedRef.current = false;

    // 1. Instant sync load from localStorage (0ms latency)
    const savedSync = loadAnnotationsForDocSync(docKey, fallbackKeys);
    setAnnotations(savedSync);
    setHistory([savedSync]);
    setHistoryIndex(0);

    // 2. Async load from IndexedDB for high-capacity payloads (images/stickers)
    let isCancelled = false;
    loadAnnotationsForDocAsync(docKey, fallbackKeys).then((savedAsync) => {
      if (isCancelled || !savedAsync) return;
      if (savedAsync.length > 0 && (savedSync.length === 0 || savedAsync.length !== savedSync.length)) {
        setAnnotations(savedAsync);
        setHistory([savedAsync]);
        setHistoryIndex(0);
      }
    });

    isLoadedRef.current = true;

    return () => {
      isCancelled = true;
    };
  }, [docKey, fallbackKeys]);

  // Auto-save on annotations change
  useEffect(() => {
    if (!isLoadedRef.current || !docKey) return;
    setSaveStatus('saving');

    saveAnnotationsForDoc(docKey, annotations, fallbackKeys);

    const timer = setTimeout(() => {
      setSaveStatus('saved');
    }, 250);

    return () => clearTimeout(timer);
  }, [annotations, docKey, fallbackKeys]);

  const pushState = useCallback((newAnnotations: Annotation[]) => {
    setHistory((prevHistory) => {
      const upToCurrent = prevHistory.slice(0, historyIndex + 1);
      const updated = [...upToCurrent, newAnnotations];
      // Keep last 40 history states for memory efficiency
      if (updated.length > 40) {
        updated.shift();
      }
      return updated;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 39));
    setAnnotations(newAnnotations);
  }, [historyIndex]);

  const addAnnotation = useCallback((annotation: Annotation) => {
    setAnnotations((prev) => {
      const updated = [...prev, annotation];
      pushState(updated);
      return updated;
    });
  }, [pushState]);

  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    setAnnotations((prev) => {
      const updated = prev.map((item) => (item.id === id ? ({ ...item, ...updates } as Annotation) : item));
      pushState(updated);
      return updated;
    });
  }, [pushState]);

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      pushState(updated);
      return updated;
    });
  }, [pushState]);

  const clearAllAnnotationsForPage = useCallback((pageNumber: number) => {
    setAnnotations((prev) => {
      const updated = prev.filter((item) => item.pageNumber !== pageNumber);
      pushState(updated);
      return updated;
    });
  }, [pushState]);

  const clearAllAnnotations = useCallback(() => {
    pushState([]);
  }, [pushState]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setAnnotations(history[newIndex]);
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setAnnotations(history[newIndex]);
    }
  }, [historyIndex, history]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Add attached image helper
  const addAttachedImage = useCallback((
    pageNumber: number,
    dataUrl: string,
    aspectRatio: number = 1.33,
    name: string = 'Attached Image',
    options?: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      pageWidth?: number;
      pageHeight?: number;
      imageWidth?: number;
      imageHeight?: number;
      attachedInInvertedMode?: boolean;
      invertInLightMode?: boolean;
    }
  ) => {
    let x = options?.x;
    let y = options?.y;
    let width = options?.width;
    let height = options?.height;
    let ar = aspectRatio;

    if (!width || !height || x === undefined || y === undefined) {
      const placement = calculateImagePlacement({
        imageWidth: options?.imageWidth,
        imageHeight: options?.imageHeight,
        aspectRatio: ar,
        pageWidth: options?.pageWidth,
        pageHeight: options?.pageHeight,
        cursorX: options?.x,
        cursorY: options?.y,
      });

      if (x === undefined) x = placement.x;
      if (y === undefined) y = placement.y;
      if (!width) width = placement.width;
      if (!height) height = placement.height;
      if (!ar || ar <= 0) ar = placement.aspectRatio;
    }

    const newImage: AttachedImageAnnotation = {
      id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      pageNumber,
      type: 'image',
      dataUrl,
      x,
      y,
      width,
      height,
      rotation: 0,
      opacity: 1,
      aspectRatio: ar,
      name,
      createdAt: Date.now(),
      attachedInInvertedMode: options?.attachedInInvertedMode ?? false,
      invertInLightMode: options?.invertInLightMode ?? (options?.attachedInInvertedMode ?? false),
    };

    addAnnotation(newImage);
    return newImage;
  }, [addAnnotation]);

  return {
    annotations,
    saveStatus,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    clearAllAnnotationsForPage,
    clearAllAnnotations,
    undo,
    redo,
    canUndo,
    canRedo,
    addAttachedImage,
    setAnnotationsDirectly: setAnnotations,
  };
}
