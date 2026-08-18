import { useEffect } from 'react';
import type { ToolType } from '../utils/types';

interface KeyboardShortcutOptions {
  onOpenPdf: () => void;
  onSavePdf: () => void;
  onSaveJson: () => void;
  onToggleInvert: () => void;
  onToggleSearch: () => void;
  onSelectTool: (tool: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  onToggleZen: () => void;
  onToggleShortcuts: () => void;
  onToggleLibrary?: () => void;
  onCopyPageText?: () => void;
  onCopyPageJpg?: () => void;
}

export function useKeyboard(options: KeyboardShortcutOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input, textarea or contenteditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        // Only allow Escape to close or Enter inside inputs
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl) {
        if (e.key.toLowerCase() === 'l') {
          e.preventDefault();
          options.onToggleLibrary?.();
        } else if (e.shiftKey && e.key.toLowerCase() === 'c') {
          e.preventDefault();
          options.onCopyPageText?.();
        } else if (e.shiftKey && e.key.toLowerCase() === 'j') {
          e.preventDefault();
          options.onCopyPageJpg?.();
        } else if (e.key.toLowerCase() === 'o') {
          e.preventDefault();
          options.onOpenPdf();
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          if (e.shiftKey) {
            options.onSaveJson();
          } else {
            options.onSavePdf();
          }
        } else if (e.key.toLowerCase() === 'i') {
          e.preventDefault();
          options.onToggleInvert();
        } else if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          options.onToggleSearch();
        } else if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            options.onRedo();
          } else {
            options.onUndo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          options.onRedo();
        } else if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          options.onZoomIn();
        } else if (e.key === '-') {
          e.preventDefault();
          options.onZoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          options.onResetZoom();
        }
      } else {
        // Single key shortcuts
        switch (e.key.toLowerCase()) {
          case 'h':
            options.onSelectTool('highlight-pen');
            break;
          case 'p':
            options.onSelectTool('pen');
            break;
          case 'i':
            options.onSelectTool('image');
            break;
          case 't':
            options.onSelectTool('text');
            break;
          case 'e':
            options.onSelectTool('eraser');
            break;
          case 'v':
            options.onSelectTool('select');
            break;
          case 'r':
            options.onSelectTool('highlight-rect');
            break;
          case 'f':
            options.onToggleZen();
            break;
          case '?':
          case '/':
            options.onToggleShortcuts();
            break;
          case 'arrowright':
          case 'j':
            options.onNextPage();
            break;
          case 'arrowleft':
          case 'k':
            options.onPrevPage();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options]);
}
