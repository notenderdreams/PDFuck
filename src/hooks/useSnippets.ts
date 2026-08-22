import { useState, useCallback, useEffect, useRef } from 'react';
import type { SnippetDividerEntry, SnippetEntry, SnippetImageEntry } from '../utils/types';

const STORAGE_PREFIX = 'pdfuck_snippets_';

export function useSnippets(docKey: string) {
  const [snippets, setSnippets] = useState<SnippetEntry[]>([]);
  const isLoadedRef = useRef(false);

  // Load saved snippets for the current document
  useEffect(() => {
    if (!docKey) return;
    isLoadedRef.current = false;

    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${docKey}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSnippets(parsed);
        } else {
          setSnippets([]);
        }
      } else {
        setSnippets([]);
      }
    } catch {
      setSnippets([]);
    }

    isLoadedRef.current = true;
  }, [docKey]);

  // Persist snippets whenever they change
  useEffect(() => {
    if (!isLoadedRef.current || !docKey) return;

    try {
      localStorage.setItem(`${STORAGE_PREFIX}${docKey}`, JSON.stringify(snippets));
    } catch (e) {
      console.warn('Failed to save snippets to storage:', e);
    }
  }, [snippets, docKey]);

  const addSnippet = useCallback((snippet: SnippetImageEntry) => {
    setSnippets((prev) => [...prev, snippet]);
  }, []);

  const addDivider = useCallback((afterId?: string, label: string = '') => {
    const newDivider: SnippetDividerEntry = {
      id: `div_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'divider',
      label,
      style: 'solid',
      createdAt: Date.now(),
    };

    setSnippets((prev) => {
      if (!afterId) {
        return [...prev, newDivider];
      }
      const index = prev.findIndex((item) => item.id === afterId);
      if (index === -1) {
        return [...prev, newDivider];
      }
      const next = [...prev];
      next.splice(index + 1, 0, newDivider);
      return next;
    });
  }, []);

  const removeEntry = useCallback((id: string) => {
    setSnippets((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const moveEntry = useCallback((id: string, direction: 'up' | 'down') => {
    setSnippets((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }, []);

  const updateDivider = useCallback((id: string, updates: Partial<SnippetDividerEntry>) => {
    setSnippets((prev) =>
      prev.map((item) => {
        if (item.id === id && item.type === 'divider') {
          return { ...item, ...updates };
        }
        return item;
      })
    );
  }, []);

  const updateSnippetLabel = useCallback((id: string, label: string) => {
    setSnippets((prev) =>
      prev.map((item) => {
        if (item.id === id && item.type === 'image') {
          return { ...item, label };
        }
        return item;
      })
    );
  }, []);

  const clearAll = useCallback(() => {
    setSnippets([]);
  }, []);

  return {
    snippets,
    addSnippet,
    addDivider,
    removeEntry,
    moveEntry,
    updateDivider,
    updateSnippetLabel,
    clearAll,
    setSnippets,
  };
}
