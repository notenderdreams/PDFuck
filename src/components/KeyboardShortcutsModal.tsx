import React from 'react';
import { X, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'Mouse & Gestures',
    items: [
      { keys: ['Cmd / Ctrl', 'Wheel'], desc: 'Zoom In / Out Smoothly' },
      { keys: ['Pinch'], desc: 'Trackpad Pinch to Zoom' },
      { keys: ['Space', 'Drag'], desc: 'Pan / Hand Tool' },
      { keys: ['Middle Click', 'Drag'], desc: 'Pan Viewport' },
      { keys: ['Cmd', 'V'], desc: 'Paste Image at Mouse Cursor' },
    ],
  },
  {
    title: 'Annotation Tools',
    items: [
      { keys: ['Cmd / Ctrl', 'Shift', 'H'], desc: 'Highlight Selected PDF Text' },
      { keys: ['L'], desc: 'Straight Line Highlighter (Auto-Snap)' },
      { keys: ['U'], desc: 'Underline Selected Text / Tool' },
      { keys: ['1–8'], desc: 'Choose Highlight Palette Color' },
      { keys: ['H'], desc: 'Freehand Highlighter Pen' },
      { keys: ['R'], desc: 'Area Highlight Box' },
      { keys: ['P'], desc: 'Freehand Pen' },
      { keys: ['C'], desc: 'Snip & Compact for AI' },
      { keys: ['A'], desc: 'Explain PDF Region with AI' },
      { keys: ['T'], desc: 'Plain Text Tool' },
      { keys: ['N'], desc: 'Sticky Note Tool' },
      { keys: ['E'], desc: 'Eraser (Sweep / Click)' },
      { keys: ['V'], desc: 'Select / Pointer Tool' },
    ],
  },
  {
    title: 'Navigation & View',
    items: [
      { keys: ['Cmd', 'Shift', 'L'], desc: 'Toggle Light / Dark Mode' },
      { keys: ['Cmd', 'L'], desc: 'Toggle Library Dashboard' },
      { keys: ['Cmd', 'O'], desc: 'Open PDF File' },
      { keys: ['Cmd', 'S'], desc: 'Save Modified PDF' },
      { keys: ['Cmd', 'I'], desc: 'Invert Colors' },
      { keys: ['Cmd', 'B'], desc: 'Toggle Reader Sidebar' },
      { keys: ['Cmd', 'F'], desc: 'Find Text in Document' },
      { keys: ['Cmd+Shift+C'], desc: 'Copy Page Text' },
      { keys: ['Cmd+Shift+J'], desc: 'Copy Page as Image' },
      { keys: ['Cmd+Shift+S'], desc: 'Copy Stitched Image' },
      { keys: ['Cmd+Shift+X'], desc: 'Dump All Snippets' },
      { keys: ['→', 'J'], desc: 'Next Page' },
      { keys: ['←', 'K'], desc: 'Previous Page' },
      { keys: ['Cmd', 'Enter'], desc: 'Toggle App Fullscreen' },
      { keys: ['F'], desc: 'Fullscreen Focus Mode (Zen)' },
    ],
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in text-xs">
      <div className="w-full max-w-xl bg-[var(--popover)] border border-[var(--border)] rounded-2xl p-5 shadow-2xl flex flex-col gap-4 animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[var(--secondary)] border border-[var(--border)] text-blue-500 shadow-xs">
              <Command className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">
                Keyboard & Mouse Shortcuts
              </h3>
              <p className="text-[11px] text-zinc-400">
                Quick gestures and keys for fast navigation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon w-7 h-7"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcut Groups */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SHORTCUT_GROUPS.map((group, gIdx) => (
            <div
              key={gIdx}
              className="p-3.5 rounded-xl bg-[var(--secondary)] border border-[var(--border)] flex flex-col gap-2.5 shadow-xs"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                {group.title}
              </span>
              <div className="flex flex-col gap-2">
                {group.items.map((item, iIdx) => (
                  <div key={iIdx} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-1.5 py-0.5 text-[9.5px] font-mono font-medium bg-[var(--card)] text-zinc-200 border border-[var(--border)] rounded-md shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                    <span className="text-[10.5px] text-zinc-400 leading-tight">
                      {item.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center text-[11px] text-zinc-500 pt-1">
          Press <kbd className="px-1.5 py-0.5 bg-[var(--secondary)] border border-[var(--border)] rounded-md text-[10px] font-mono text-zinc-300">?</kbd> anytime to open shortcuts.
        </div>
      </div>
    </div>
  );
};
